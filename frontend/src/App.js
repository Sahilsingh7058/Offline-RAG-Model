import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, File as FileIcon, Bot, User, Loader2, Search, X, BrainCircuit, Sparkles, Lightbulb, ArrowRight, Sun, Moon, Home } from 'lucide-react';

// New Background Animation Component
const BackgroundAnimation = ({ theme }) => (
    <div className={`absolute inset-0 z-0 transition-colors duration-1000 ${theme === 'dark' ? 'bg-black' : 'bg-gray-100'}`}>
        {/* You can add more complex animations here if desired */}
    </div>
);


// Main App Component
const App = () => {
    const [page, setPage] = useState('landing'); // 'landing' or 'app'
    const [theme, setTheme] = useState('dark'); // 'dark' or 'light'
    const [files, setFiles] = useState([]);
    const [isIndexing, setIsIndexing] = useState(false);
    const [indexedFiles, setIndexedFiles] = useState(new Set());
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [ragState, setRagState] = useState('idle');
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    
    // State for Gemini API features
    const [fileSummaries, setFileSummaries] = useState({});
    const [chatInsights, setChatInsights] = useState({});

    useEffect(() => {
        document.documentElement.className = theme;
    }, [theme]);

    const addFiles = useCallback((selectedFiles) => {
        const newFiles = Array.from(selectedFiles).map(file => ({
            id: `${file.name}-${file.lastModified}`,
            name: file.name,
            fileObject: file,
        })).filter(newFile => !files.some(f => f.id === newFile.id));
        setFiles(prev => [...prev, ...newFiles]);
    }, [files]);

    const handleFileChange = (e) => addFiles(e.target.files);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        addFiles(e.dataTransfer.files);
    }, [addFiles]);

    const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
    const removeFile = (fileId) => setFiles(prev => prev.filter(f => f.id !== fileId));

    const handleIndexing = async () => {
        setIsIndexing(true);
        setError(null);
        try {
            const filesToUpload = files.filter(f => !indexedFiles.has(f.name));
            if (filesToUpload.length === 0) {
                setIsIndexing(false);
                return;
            }
            const uploadPromises = filesToUpload.map(f => {
                const formData = new FormData();
                formData.append('file', f.fileObject);
                return fetch('http://127.0.0.1:8000/upload/', { method: 'POST', body: formData });
            });
            await Promise.all(uploadPromises);

            const response = await fetch('http://127.0.0.1:8000/index/', { method: 'POST' });
            if (!response.ok) throw new Error('Indexing failed on the server.');
            
            const allFileNames = new Set(files.map(f => f.name));
            setIndexedFiles(allFileNames);
        } catch (err) {
            setError("Error: Indexing failed. Is the backend running?");
        } finally {
            setIsIndexing(false);
        }
    };
    
    const handleQuerySubmit = async (e) => {
        e.preventDefault();
        if (!query.trim() || ragState !== 'idle' || indexedFiles.size === 0) return;
    
        const userMessage = { sender: 'user', text: query };
        setChatHistory(prev => [...prev, userMessage]);
        setRagState('processing');
    
        try {
            const response = await fetch('http://127.0.0.1:8000/query/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: query }),
            });
    
            if (!response.ok) throw new Error('Failed to get answer from the server.');
    
            const result = await response.json();
            const botMessage = { sender: 'bot', text: result.answer, sources: result.sources };
            setChatHistory(prev => [...prev, botMessage]);
    
        } catch (err) {
            console.error("Query error:", err);
            const errorMessage = { sender: 'bot', text: 'Sorry, I encountered an error. Please ensure the backend server is running and try again.' };
            setChatHistory(prev => [...prev, errorMessage]);
        } finally {
            setRagState('idle');
            setQuery('');
        }
    };
    
    const handleGenerateSummary = async (fileId, fileName) => {
        setFileSummaries(prev => ({ ...prev, [fileId]: { summary: null, loading: true } }));

        const userQuery = `Provide a short, one-paragraph summary for a document titled "${fileName}". Based on the title, what is the document likely about?`;
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: userQuery }] }] })
            });
            if (!response.ok) throw new Error('API request failed');
            const result = await response.json();
            const summary = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (summary) {
                 setFileSummaries(prev => ({ ...prev, [fileId]: { summary, loading: false } }));
            } else {
                throw new Error("Invalid response from API.");
            }
        } catch (error) {
            console.error("Gemini summary error:", error);
            setFileSummaries(prev => ({ ...prev, [fileId]: { summary: "Could not generate summary.", loading: false } }));
        }
    };

    const handleAugmentQuery = async () => {
        if (!query.trim()) return;
        const originalQuery = query;
        setQuery("✨ Augmenting query with Gemini...");

        const userQuery = `Rephrase and expand the following user query to be more effective for a semantic search system. Return only the improved query and nothing else. Original query: "${originalQuery}"`;
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: userQuery }] }] })
            });
            if (!response.ok) throw new Error('API request failed');
            const result = await response.json();
            const augmentedQuery = result.candidates?.[0]?.content?.parts?.[0]?.text;
            setQuery(augmentedQuery || originalQuery);
        } catch(error) {
            console.error("Gemini augmentation error:", error);
            setQuery(originalQuery); // Revert on error
        }
    };

    const handleExtractInsights = async (messageText, messageIndex) => {
        setChatInsights(prev => ({ ...prev, [messageIndex]: { insights: null, loading: true } }));

        const userQuery = `Analyze the following text and extract the top 3-5 key insights or actionable items. Present them as a bulleted list. Text: "${messageText}"`;
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        try {
             const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: userQuery }] }] })
            });
            if (!response.ok) throw new Error('API request failed');
            const result = await response.json();
            const insights = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (insights) {
                setChatInsights(prev => ({ ...prev, [messageIndex]: { insights, loading: false } }));
            } else {
                 throw new Error("Invalid response from API.");
            }
        } catch (error) {
            console.error("Gemini insights error:", error);
            setChatInsights(prev => ({ ...prev, [messageIndex]: { insights: "Could not extract insights.", loading: false } }));
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    if (page === 'landing') {
        return (
            <div className={`font-sans relative overflow-hidden transition-colors duration-1000 ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                <BackgroundAnimation theme={theme} />
                <div className="relative z-10 flex flex-col h-screen">
                    <nav className="flex justify-between items-center p-6">
                        <div className="font-serif text-2xl font-bold">OfflineGenie</div>
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full transition-colors duration-300 hover:bg-gray-500/20">
                            {theme === 'dark' ? <Sun /> : <Moon />}
                        </button>
                    </nav>
                    <main className="flex-1 flex flex-col items-center justify-center text-center">
                        <h1 className="text-8xl md:text-9xl font-serif font-bold tracking-tighter">OfflineGenie</h1>
                        <p className={`text-xl md:text-2xl mt-4 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Your private, offline RAG assistant.</p>
                        <p className={`transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>Converse with your documents, securely on your machine.</p>
                        <button 
                            onClick={() => setPage('app')}
                            className={`mt-12 px-8 py-4 rounded-full text-lg flex items-center gap-2 group transition-all duration-300 hover:scale-105 animate-pulse-glow ${theme === 'dark' ? 'bg-white text-black font-semibold' : 'bg-black text-white font-semibold'}`}
                        >
                            Enter App
                            <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                        </button>
                    </main>
                </div>
            </div>
        );
    }

    const isReadyToQuery = indexedFiles.size > 0 && !isIndexing;

    return (
        <div className={`flex flex-col h-screen font-sans transition-colors duration-1000 ${theme === 'dark' ? 'bg-black text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
             <div className="relative z-10 flex flex-col h-full">
                {error && (
                    <div className="bg-red-900/80 text-red-200 text-center p-2 border-b border-red-500/30">
                        {error}
                    </div>
                )}
                <header className={`relative p-4 text-center border-b transition-colors duration-1000 ${theme === 'dark' ? 'border-gray-800/50' : 'border-gray-200'}`}>
                    <button 
                        onClick={() => setPage('landing')}
                        className={`absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all duration-300 ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-gray-600 hover:text-black hover:shadow-[0_0_15px_rgba(0,0,0,0.2)]'}`}
                        title="Go back to Home"
                    >
                        <Home className="w-5 h-5" />
                    </button>
                    <h1 className={`text-2xl font-bold tracking-widest uppercase transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-100' : 'text-black'}`}>
                        OfflineGenie
                    </h1>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    <div className={`w-1/3 border-r flex flex-col p-4 space-y-4 transition-colors duration-1000 ${theme === 'dark' ? 'border-gray-800/50' : 'border-gray-200'}`}>
                        <div 
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg h-48 transition-colors duration-1000 ${theme === 'dark' ? 'border-gray-700 bg-gray-900/20 hover:border-gray-500' : 'border-gray-300 bg-gray-200/20 hover:border-gray-400'}`}
                            onDrop={handleDrop} onDragOver={handleDragOver}
                        >
                            <UploadCloud className={`w-12 h-12 mb-2 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} />
                            <p className={`text-center font-semibold transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Drag & drop files here</p>
                            <p className={`text-sm transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>or</p>
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                className={`font-semibold transition-all duration-300 rounded-md px-3 py-1 ${theme === 'dark' ? 'text-gray-300 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-gray-700 hover:text-black hover:shadow-[0_0_15px_rgba(0,0,0,0.2)]'}`}
                            >
                                Browse Files
                            </button>
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                            <h2 className={`text-lg font-bold py-2 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>File Queue ({files.length})</h2>
                            {files.length === 0 && <p className={`text-center py-4 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>Upload documents to begin.</p>}
                            {files.map((file) => (
                                <div key={file.id}>
                                    <div className={`flex items-center justify-between p-2 rounded-md transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-900/40' : 'bg-white shadow-sm'}`}>
                                        <div className="flex items-center space-x-3 overflow-hidden">
                                            <FileIcon className={`w-5 h-5 flex-shrink-0 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`} />
                                            <span className={`truncate text-sm font-medium transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>{file.name}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {indexedFiles.has(file.name) && (
                                                <button 
                                                    onClick={() => handleGenerateSummary(file.id, file.name)} 
                                                    disabled={fileSummaries[file.id]?.loading} 
                                                    className={`p-1 disabled:opacity-50 transition-all duration-300 rounded-full ${theme === 'dark' ? 'text-purple-400 hover:text-purple-300 hover:shadow-[0_0_10px_rgba(192,132,252,0.5)]' : 'text-purple-600 hover:text-purple-500 hover:shadow-[0_0_10px_rgba(192,132,252,0.7)]'}`}
                                                    title="✨ Summarize with Gemini"
                                                >
                                                    {fileSummaries[file.id]?.loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => removeFile(file.id)} 
                                                className={`p-1 transition-all duration-300 rounded-full ${theme === 'dark' ? 'text-gray-600 hover:text-red-400 hover:shadow-[0_0_10px_rgba(248,113,113,0.5)]' : 'text-gray-400 hover:text-red-500 hover:shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {fileSummaries[file.id] && !fileSummaries[file.id].loading && (
                                        <div className={`mt-2 p-3 rounded text-sm border transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-800/50 text-gray-400 border-gray-700/50' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                            <p>{fileSummaries[file.id].summary}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        <button
                            onClick={handleIndexing}
                            disabled={isIndexing || files.length === 0}
                            className={`w-full py-3 px-4 rounded-lg font-bold text-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-500 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] focus:ring-offset-black focus:ring-gray-500' : 'bg-gray-200 hover:bg-gray-300 disabled:bg-gray-200/50 disabled:text-gray-400 hover:shadow-[0_0_20px_rgba(0,0,0,0.1)] focus:ring-offset-white focus:ring-gray-400'}`}
                        >
                            {isIndexing ? <span className="flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Indexing...</span> : 'Index All Files'}
                        </button>
                    </div>

                    <div className={`w-2/3 flex flex-col transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-900/30' : 'bg-white'}`}>
                        <div className="flex-1 p-6 overflow-y-auto">
                            <div className="space-y-6">
                                {chatHistory.length === 0 && (
                                    <div className={`text-center h-full flex flex-col justify-center items-center transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                                        <BrainCircuit className="w-20 h-20 mb-4"/>
                                        <h2 className={`text-2xl font-bold transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Welcome!</h2>
                                        <p className="text-lg">Index your local files to start a private conversation with your data.</p>
                                    </div>
                                )}
                                {chatHistory.map((msg, index) => (
                                    <div key={index}>
                                        <div className={`flex items-start gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            {msg.sender === 'bot' && <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'}`}><Bot className={`w-5 h-5 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}/></div>}
                                            <div className="max-w-2xl">
                                                <div className={`p-4 rounded-xl ${msg.sender === 'user' ? (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200') : (theme === 'dark' ? 'bg-gray-800/60' : 'bg-white shadow-md')}`}>
                                                    <p className={`whitespace-pre-wrap text-base transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>{msg.text}</p>
                                                    {msg.sources && msg.sources.length > 0 && (
                                                        <div className={`mt-4 border-t pt-3 transition-colors duration-1000 ${theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200'}`}>
                                                            <h4 className={`text-xs font-bold mb-2 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>SOURCES:</h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                {msg.sources.map(source => (
                                                                    <div key={source} className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                                                                        <FileIcon className="w-3 h-3"/>
                                                                        {source}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {msg.sender === 'user' && <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`}><User className={`w-5 h-5 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}/></div>}
                                        </div>
                                        {msg.sender === 'bot' && (
                                            <div className="text-right mt-2 mr-12">
                                                 <button 
                                                    onClick={() => handleExtractInsights(msg.text, index)} 
                                                    disabled={chatInsights[index]?.loading} 
                                                    className={`text-xs font-medium disabled:opacity-50 flex items-center gap-1 ml-auto transition-all duration-300 p-1 rounded-full ${theme === 'dark' ? 'text-yellow-400 hover:text-yellow-300 hover:shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'text-yellow-600 hover:text-yellow-500 hover:shadow-[0_0_15px_rgba(250,204,21,0.7)]'}`}
                                                    title="✨ Extract Insights with Gemini"
                                                 >
                                                    {chatInsights[index]?.loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Lightbulb className="w-4 h-4"/>}
                                                    <span>Extract Insights</span>
                                                 </button>
                                            </div>
                                        )}
                                        {chatInsights[index] && !chatInsights[index].loading && (
                                            <div className={`mt-2 ml-12 p-4 rounded-lg text-sm max-w-2xl border transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700/50 text-gray-300' : 'bg-yellow-50 border-yellow-200 text-gray-700'}`}>
                                                <h5 className={`font-bold mb-2 flex items-center gap-2 transition-colors duration-1000 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}><Lightbulb className="w-4 h-4"/> Key Insights:</h5>
                                                <ul className="list-disc pl-5 space-y-1">
                                                    {chatInsights[index].insights.split('\n').map((item, i) => item.trim().replace(/^\* /, '') && <li key={i}>{item.trim().replace(/^\* /, '')}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {ragState === 'processing' && (
                                    <div className="flex items-start gap-4 justify-start">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'}`}><Bot className={`w-5 h-5 transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}/></div>
                                        <div className={`max-w-2xl p-4 rounded-lg flex items-center space-x-3 transition-colors duration-1000 ${theme === 'dark' ? 'bg-gray-800/60' : 'bg-white shadow-md'}`}>
                                            <Loader2 className={`w-5 h-5 animate-spin transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                                            <span className={`transition-colors duration-1000 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                        </div>
                        <div className={`p-4 border-t transition-colors duration-1000 ${theme === 'dark' ? 'border-gray-800/50' : 'border-gray-200'}`}>
                            <form onSubmit={handleQuerySubmit} className="relative">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={isReadyToQuery ? "Ask a question about your files..." : "Please index files to enable chat"}
                                    disabled={!isReadyToQuery || ragState !== 'idle'}
                                    className={`w-full border rounded-lg py-3 pl-4 pr-24 text-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ${theme === 'dark' ? 'bg-gray-800/60 border-gray-700 text-gray-200 focus:ring-offset-black focus:ring-gray-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-offset-white focus:ring-indigo-500'}`}
                                />
                                 {query.trim() && (
                                     <button 
                                        type="button" 
                                        onClick={handleAugmentQuery} 
                                        title="Augment Query with Gemini" 
                                        className={`absolute right-16 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all duration-300 ${theme === 'dark' ? 'text-purple-400 hover:text-purple-300 hover:shadow-[0_0_15px_rgba(192,132,252,0.6)]' : 'text-purple-600 hover:text-purple-500 hover:shadow-[0_0_15px_rgba(192,132,252,0.8)]'}`}
                                     >
                                        <Sparkles className="w-5 h-5" />
                                     </button>
                                  )}
                                <button 
                                    type="submit" 
                                    disabled={!isReadyToQuery || ragState !== 'idle' || !query.trim()} 
                                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 disabled:cursor-not-allowed transition-all duration-300 rounded-full ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] disabled:hover:text-gray-500' : 'text-gray-500 hover:text-black hover:shadow-[0_0_15px_rgba(0,0,0,0.2)] disabled:hover:text-gray-500'}`}
                                >
                                    <Search className="w-5 h-5" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;

