# AI Resume Analyzer - Full Stack Application

This package contains a full-stack application for analyzing resumes against job descriptions using AI and NLP techniques.

## Components

1. **Backend API (Flask)**: Handles resume processing, NLP analysis, and scoring
2. **Frontend UI (React)**: Modern dark-themed interface for uploading resumes and viewing results

## Setup Instructions

### Prerequisites
- Python 3.9+ with pip
- Node.js 16+ with npm or pnpm
- Internet connection (for initial NLP model downloads)

### Backend Setup
1. Navigate to the `resume-analyzer-api` directory
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Start the server: `python src/main.py`
   - The API will be available at http://localhost:5000

### Frontend Setup
1. Navigate to the `resume-analyzer-ui` directory
2. Install dependencies: `npm install` or `pnpm install`
3. Start the development server: `npm run dev` or `pnpm run dev`
   - The UI will be available at http://localhost:5173

## Usage
1. Open the frontend application in your browser
2. Upload one or more PDF resumes
3. Enter a job description
4. Click "Analyze Resumes" to process and view results
5. Export results as needed

## Features
- PDF resume upload (single or batch)
- Job description text input
- AI-powered similarity scoring
- Skill gap analysis (strengths and missing skills)
- Visual results dashboard
- Results export functionality

## API Endpoints
- `POST /api/analyzer/upload-resumes`: Upload PDF resumes
- `POST /api/analyzer/submit-job-description`: Submit job description text
- `POST /api/analyzer/analyze`: Analyze resumes against job description

## Technologies Used
- **Backend**: Flask, spaCy, NLTK, scikit-learn, PyPDF2
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui

## Notes
- First run will download NLP models (~600MB) which may take a few minutes
- For production deployment, consider using a proper WSGI server for the backend
