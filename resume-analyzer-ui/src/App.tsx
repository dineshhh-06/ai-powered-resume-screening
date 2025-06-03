import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

// API base URL - would be configured based on environment in a real app
const API_BASE_URL = 'http://localhost:5000/api';

interface UploadedFile {
  original_name: string;
  stored_name: string;
  path: string;
}

interface AnalysisResult {
  resume: string;
  status: 'success' | 'error';
  match_score?: number;
  key_strengths?: string[];
  missing_skills?: string[];
  feedback?: string;
  message?: string;
}

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [activeTab, setActiveTab] = useState('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleJobDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJobDescription(e.target.value);
  };

  const uploadResumes = async (): Promise<UploadedFile[]> => {
    if (files.length === 0) return [];

    setIsUploading(true);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('resumes', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/analyzer/upload-resumes`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload resumes');
      }

      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${data.files.length} resume(s)`,
        variant: "default",
      });

      return data.files;
    } catch (error) {
      console.error('Error uploading resumes:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : 'Failed to upload resumes',
        variant: "destructive",
        action: <ToastAction altText="Try again">Try again</ToastAction>,
      });
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const submitJobDescription = async (): Promise<string> => {
    if (!jobDescription.trim()) return '';

    try {
      const response = await fetch(`${API_BASE_URL}/analyzer/submit-job-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_description: jobDescription }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit job description');
      }

      return data.job_description;
    } catch (error) {
      console.error('Error submitting job description:', error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : 'Failed to submit job description',
        variant: "destructive",
      });
      return '';
    }
  };

  const analyzeResumes = async (uploadedFiles: UploadedFile[], jobDesc: string) => {
    if (uploadedFiles.length === 0 || !jobDesc) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/analyzer/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resume_files: uploadedFiles,
          job_description: jobDesc,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Analysis failed');
      }

      setResults(data.results);
      setActiveTab('results');
      
      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${data.results.filter((r: AnalysisResult) => r.status === 'success').length} resume(s)`,
        variant: "default",
      });
    } catch (error) {
      console.error('Error analyzing resumes:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : 'Failed to analyze resumes',
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    // First upload the files
    const uploaded = await uploadResumes();
    if (uploaded.length === 0) return;
    
    setUploadedFiles(uploaded);
    // setUploadedFiles(uploaded); // removed unused state
    // Then submit the job description
    const submittedJD = await submitJobDescription();
    if (!submittedJD) return;
    
    // Finally analyze the resumes
    await analyzeResumes(uploaded, submittedJD);
  };

  const exportResults = () => {
    if (results.length === 0) return;
    
    // Create CSV content
    const headers = ['Resume', 'Match Score', 'Key Strengths', 'Missing Skills', 'Feedback'];
    const csvRows = [headers];
    
    results.forEach(result => {
      if (result.status === 'success') {
        csvRows.push([
          result.resume,
          result.match_score?.toString() || '0',
          (result.key_strengths || []).join(', '),
          (result.missing_skills || []).join(', '),
          result.feedback || ''
        ]);
      } else {
        csvRows.push([
          result.resume,
          'Error',
          '',
          '',
          result.message || 'Processing error'
        ]);
      }
    });
    
    const csvContent = csvRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `resume_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAnalyzeDisabled = files.length === 0 || jobDescription.trim() === '' || isUploading || isAnalyzing;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b">
        <div className="container mx-auto py-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            AI Resume Analyzer
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload & Analyze</TabsTrigger>
            <TabsTrigger value="results" disabled={results.length === 0}>Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Resume Upload Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Upload Resumes</CardTitle>
                  <CardDescription>
                    Select one or more PDF resumes to analyze
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div 
                      className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground text-center">
                        Drag & drop PDF files here or click to browse
                      </p>
                    </div>

                    {files.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Selected Files ({files.length})</p>
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2">
                            {files.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="h-4 w-4 flex-shrink-0" />
                                  <span className="text-sm truncate">{file.name}</span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => removeFile(index)}
                                  className="h-6 w-6 p-0 rounded-full"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Job Description Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Job Description</CardTitle>
                  <CardDescription>
                    Paste the job description to match against
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    placeholder="Paste job description here..."
                    className="min-h-[280px] resize-none"
                    value={jobDescription}
                    onChange={handleJobDescriptionChange}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {jobDescription.length} characters
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Analyze Button */}
            <div className="flex justify-center">
              <Button 
                size="lg" 
                disabled={isAnalyzeDisabled}
                onClick={handleAnalyze}
                className="w-full max-w-md"
              >
                {isUploading ? (
                  <>
                    <span className="mr-2">Uploading...</span>
                    <Progress value={50} className="w-20 h-2" />
                  </>
                ) : isAnalyzing ? (
                  <>
                    <span className="mr-2">Analyzing...</span>
                    <Progress value={75} className="w-20 h-2" />
                  </>
                ) : (
                  "Analyze Resumes"
                )}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="results" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  Resume match scores and skill analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {results.length > 0 ? (
                  <div className="space-y-6">
                    {results.map((result, index) => (
                      <div key={index} className="space-y-4">
                        {index > 0 && <Separator />}
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            <h3 className="font-medium">{result.resume}</h3>
                            {result.status === 'success' ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </div>
                          
                          {result.status === 'success' && result.match_score !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Match Score:</span>
                              <div className="w-full max-w-[200px] flex items-center gap-2">
                                <Progress value={result.match_score} className="h-2" />
                                <span className="text-sm font-medium">{result.match_score.toFixed(1)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {result.status === 'success' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium">Key Strengths</h4>
                              <div className="flex flex-wrap gap-2">
                                {result.key_strengths && result.key_strengths.length > 0 ? (
                                  result.key_strengths.map((skill, i) => (
                                    <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                                      {skill}
                                    </Badge>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">No key strengths identified</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium">Missing Skills</h4>
                              <div className="flex flex-wrap gap-2">
                                {result.missing_skills && result.missing_skills.length > 0 ? (
                                  result.missing_skills.map((skill, i) => (
                                    <Badge key={i} variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                      {skill}
                                    </Badge>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">No missing skills identified</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="col-span-1 md:col-span-2">
                              <h4 className="text-sm font-medium">Feedback</h4>
                              <p className="text-sm text-muted-foreground">{result.feedback}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-destructive/10 rounded-md">
                            <p className="text-sm text-destructive">{result.message}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Results Available</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Upload resumes and provide a job description to see analysis results.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveTab('upload')}>
                  Back to Upload
                </Button>
                <Button 
                  variant="outline" 
                  disabled={results.length === 0}
                  onClick={exportResults}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Results
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t py-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>AI Resume Analyzer &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
function setUploadedFiles(_uploaded: UploadedFile[]) {
  throw new Error('Function not implemented.');
}

