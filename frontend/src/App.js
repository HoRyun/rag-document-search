import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('http://localhost:8000/documents');
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      await axios.post('http://localhost:8000/upload', formData);
      setFile(null);
      fetchDocuments();
      alert('Document uploaded successfully');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error uploading document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;

    const formData = new FormData();
    formData.append('query', query);

    setIsQuerying(true);
    try {
      const response = await axios.post('http://localhost:8000/query', formData);
      setAnswer(response.data.answer);
    } catch (error) {
      console.error('Error querying:', error);
      setAnswer('Error processing your query');
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>RAG Document Search</h1>
      </header>
      
      <main>
        <section className="upload-section">
          <h2>Upload Document</h2>
          <div className="upload-form">
          <input 
            type="file" 
            accept=".pdf,.docx,.hwp,.hwpx" 
            onChange={handleFileChange} 
          />
            <button 
              onClick={handleUpload} 
              disabled={!file || isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </section>
        
        <section className="documents-section">
          <h2>Documents ({documents.length})</h2>
          <ul className="document-list">
            {documents.map((doc, index) => (
              <li key={index} className="document-item">
                <span>{doc.filename}</span>
                <span>{new Date(doc.uploaded_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
        
        <section className="query-section">
          <h2>Ask a Question</h2>
          <div className="query-form">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your question here..."
              rows={3}
            />
            <button 
              onClick={handleQuery}
              disabled={!query.trim() || isQuerying}
            >
              {isQuerying ? 'Processing...' : 'Ask'}
            </button>
          </div>
          
          {answer && (
            <div className="answer-container">
              <h3>Answer:</h3>
              <div className="answer-content">{answer}</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
