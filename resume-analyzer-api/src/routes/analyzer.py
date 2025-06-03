from flask import Blueprint, request, jsonify
import os
import tempfile
import uuid
import PyPDF2
import re
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
import spacy
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import io
import pandas as pd
import json

# Initialize blueprint
analyzer_bp = Blueprint('analyzer', __name__)

# Configure upload settings
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'resume_uploads')
ALLOWED_EXTENSIONS = {'pdf'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# NLP resources initialization
nlp = None
stop_words = None
lem = None

def load_nlp_resources():
    """Downloads NLTK data and loads spaCy model."""
    global nlp, stop_words, lem
    
    # Only load if not already loaded
    if nlp is not None and stop_words is not None and lem is not None:
        return
    
    # NLTK downloads - using direct download instead of find/lookup
    nltk.download('wordnet')
    nltk.download('stopwords')
    nltk.download('punkt')
    
    # spaCy model download/load
    NLP_MODEL = "en_core_web_lg"
    try:
        nlp = spacy.load(NLP_MODEL)
    except OSError:
        print(f"Downloading spaCy model: {NLP_MODEL}")
        print(f"Downloading required NLP model ({NLP_MODEL})... This may take a few minutes.")
        spacy.cli.download(NLP_MODEL)
        nlp = spacy.load(NLP_MODEL)
        print(f"NLP model ({NLP_MODEL}) downloaded and loaded successfully.")
    
    stop_words = set(stopwords.words("english"))
    lem = WordNetLemmatizer()

# Load NLP resources when the module is imported
load_nlp_resources()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_path):
    """Extracts text from a PDF file."""
    text = ""
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return None
    
    if not text:
        return None
    return text

def preprocess(text):
    """Cleans and preprocesses text using NLTK."""
    if not text:
        return ""
    text = re.sub(r'\W+', ' ', text.lower())
    tokens = word_tokenize(text)
    processed_tokens = [lem.lemmatize(t) for t in tokens if t not in stop_words and len(t) > 1]
    return ' '.join(processed_tokens)

def calculate_similarity(jd_text, resume_text):
    """Calculates cosine similarity between JD and resume using spaCy vectors."""
    if not jd_text or not resume_text:
        return 0.0
    jd_doc = nlp(jd_text)
    resume_doc = nlp(resume_text)
    if not jd_doc.has_vector or not resume_doc.has_vector or not jd_doc.vector_norm or not resume_doc.vector_norm:
        return 0.0
    similarity = cosine_similarity([jd_doc.vector], [resume_doc.vector])[0][0]
    return max(0.0, min(1.0, similarity)) * 100

def extract_skills(text):
    """Extracts potential skills (noun chunks) from text using spaCy."""
    if not text:
        return set()
    doc = nlp(text)
    skills = {chunk.text.lower() for chunk in doc.noun_chunks if len(chunk.text.split()) <= 3}
    skills = {s for s in skills if len(s) > 2 and not all(token in stop_words for token in s.split())}
    return skills

def analyze_skills(jd_processed, resume_processed):
    """Performs skill gap analysis."""
    jd_skills = extract_skills(jd_processed)
    resume_skills = extract_skills(resume_processed)
    if not jd_skills:
        return [], [], "Could not extract skills from Job Description."
    
    strengths = list(jd_skills.intersection(resume_skills))
    missing_skills = list(jd_skills.difference(resume_skills))
    
    feedback = f"Candidate shows strength in {len(strengths)} key areas. "
    if missing_skills:
        feedback += f"Potential gaps identified in {len(missing_skills)} areas like: {', '.join(missing_skills[:3])}..."
    else:
        feedback += "Covers all key skill areas identified."
    
    MAX_SKILLS_DISPLAY = 10
    return strengths[:MAX_SKILLS_DISPLAY], missing_skills[:MAX_SKILLS_DISPLAY], feedback

@analyzer_bp.route('/upload-resumes', methods=['POST'])
def upload_resumes():
    """
    API endpoint to handle resume file uploads
    
    Expects:
    - Files in the 'resumes' field (multiple files allowed)
    
    Returns:
    - JSON with uploaded file information and status
    """
    if 'resumes' not in request.files:
        return jsonify({
            'status': 'error',
            'message': 'No resume files provided'
        }), 400
    
    files = request.files.getlist('resumes')
    
    if not files or files[0].filename == '':
        return jsonify({
            'status': 'error',
            'message': 'No resume files selected'
        }), 400
    
    uploaded_files = []
    
    for file in files:
        if file and allowed_file(file.filename):
            # Generate a unique filename to prevent collisions
            original_filename = file.filename
            safe_filename = ''.join(c for c in original_filename if c.isalnum() or c in '._-')
            file_extension = safe_filename.rsplit('.', 1)[1].lower() if '.' in safe_filename else 'pdf'
            unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
            
            filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
            file.save(filepath)
            
            uploaded_files.append({
                'original_name': original_filename,
                'stored_name': unique_filename,
                'path': filepath
            })
    
    if not uploaded_files:
        return jsonify({
            'status': 'error',
            'message': 'No valid PDF files were uploaded'
        }), 400
    
    return jsonify({
        'status': 'success',
        'message': f'Successfully uploaded {len(uploaded_files)} resume(s)',
        'files': uploaded_files
    })

@analyzer_bp.route('/submit-job-description', methods=['POST'])
def submit_job_description():
    """
    API endpoint to handle job description submission
    
    Expects:
    - JSON with 'job_description' field
    
    Returns:
    - JSON with status and the stored job description ID
    """
    data = request.get_json()
    
    if not data or 'job_description' not in data:
        return jsonify({
            'status': 'error',
            'message': 'No job description provided'
        }), 400
    
    job_description = data['job_description']
    
    if not job_description or len(job_description.strip()) == 0:
        return jsonify({
            'status': 'error',
            'message': 'Job description cannot be empty'
        }), 400
    
    # Generate a unique ID for this job description
    jd_id = uuid.uuid4().hex
    
    # In a production app, we would store this in a database
    # For this demo, we'll just return the ID
    
    return jsonify({
        'status': 'success',
        'message': 'Job description received',
        'jd_id': jd_id,
        'job_description': job_description
    })

@analyzer_bp.route('/analyze', methods=['POST'])
def analyze_resumes():
    """
    API endpoint to analyze resumes against a job description
    
    Expects:
    - JSON with 'resume_files' array and 'job_description' string
    
    Returns:
    - JSON with analysis results
    """
    data = request.get_json()
    
    if not data:
        return jsonify({
            'status': 'error',
            'message': 'No data provided'
        }), 400
    
    if 'resume_files' not in data or not data['resume_files']:
        return jsonify({
            'status': 'error',
            'message': 'No resume files specified for analysis'
        }), 400
    
    if 'job_description' not in data or not data['job_description']:
        return jsonify({
            'status': 'error',
            'message': 'No job description provided for analysis'
        }), 400
    
    job_description_raw = data['job_description']
    resume_files = data['resume_files']
    
    # Preprocess job description
    jd_processed = preprocess(job_description_raw)
    if not jd_processed:
        return jsonify({
            'status': 'error',
            'message': 'Could not process the job description'
        }), 400
    
    results_list = []
    valid_resumes_count = 0
    
    # Process each resume
    for resume_file in resume_files:
        if 'path' not in resume_file:
            continue
        
        file_path = resume_file['path']
        original_name = resume_file.get('original_name', os.path.basename(file_path))
        
        # Extract text from PDF
        resume_text_raw = extract_text_from_pdf(file_path)
        if not resume_text_raw:
            results_list.append({
                'resume': original_name,
                'status': 'error',
                'message': 'Could not extract text from PDF'
            })
            continue
        
        # Preprocess resume text
        resume_text_processed = preprocess(resume_text_raw)
        if not resume_text_processed:
            results_list.append({
                'resume': original_name,
                'status': 'error',
                'message': 'Could not preprocess resume text'
            })
            continue
        
        # Calculate similarity score
        match_score = calculate_similarity(jd_processed, resume_text_processed)
        
        # Analyze skills
        strengths, missing, feedback = analyze_skills(jd_processed, resume_text_processed)
        
        # Add to results
        results_list.append({
            'resume': original_name,
            'status': 'success',
            'match_score': round(match_score, 1),
            'key_strengths': strengths,
            'missing_skills': missing,
            'feedback': feedback
        })
        
        valid_resumes_count += 1
    
    if valid_resumes_count == 0:
        return jsonify({
            'status': 'error',
            'message': 'No valid resumes could be processed'
        }), 400
    
    return jsonify({
        'status': 'success',
        'message': f'Successfully analyzed {valid_resumes_count} resume(s)',
        'results': results_list
    })
