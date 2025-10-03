import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# Using the stable PyPDFLoader for PDFs
from langchain_community.document_loaders import PyPDFLoader, UnstructuredCSVLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama

# --- 1. APP INITIALIZATION ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# --- 2. GLOBAL VARIABLES & SETUP ---
UPLOAD_DIR = "uploaded_files"
DB_DIR = "vector_db"
os.makedirs(UPLOAD_DIR, exist_ok=True)

print("Loading embedding model... (This may take a moment on first run)")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
print("Embedding model loaded.")
llm = Ollama(model="llama3")
vector_store = None

# --- 3. HELPER FUNCTIONS ---
def get_loader(file_path: str):
    """Selects a stable document loader based on file extension."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return PyPDFLoader(file_path)
    elif ext == ".csv":
        return UnstructuredCSVLoader(file_path, mode="elements")
    else:
        # For simplicity, we'll treat other files as plain text.
        # You can add more specific loaders here (e.g., for DOCX).
        print(f"Warning: Unsupported file type '{ext}'. Treating as plain text.")
        return PyPDFLoader(file_path) # PyPDFLoader can often handle text files


def clear_database():
    """Clears the vector database and uploaded files."""
    global vector_store
    if os.path.exists(DB_DIR): shutil.rmtree(DB_DIR)
    if os.path.exists(UPLOAD_DIR): shutil.rmtree(UPLOAD_DIR)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    vector_store = None
    print("Database and uploaded files cleared.")

# --- 4. API ENDPOINTS ---
@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"filename": file.filename, "status": "saved"}

@app.post("/index/")
async def index_files():
    global vector_store
    
    print("Starting indexing process...")
    documents = []
    
    filenames = os.listdir(UPLOAD_DIR)
    if not filenames:
        raise HTTPException(status_code=400, detail="No files uploaded to index.")

    for filename in filenames:
        file_path = os.path.join(UPLOAD_DIR, filename)
        try:
            loader = get_loader(file_path)
            loaded_docs = loader.load()
            if loaded_docs:
                documents.extend(loaded_docs)
            else:
                print(f"Warning: No content loaded from {filename}")
        except Exception as e:
            print(f"Error loading {filename}: {e}")
            continue

    if not documents:
        raise HTTPException(status_code=500, detail="Could not load any valid documents.")

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    texts = text_splitter.split_documents(documents)
    
    print(f"Creating vector store from {len(texts)} text chunks...")
    db = FAISS.from_documents(texts, embeddings)
    db.save_local(DB_DIR)
    vector_store = db
    print("Indexing complete.")
    return {"status": "success", "indexed_files": len(filenames)}

@app.post("/query/")
async def query_rag(query: dict):
    global vector_store
    user_query = query.get("text")
    if not user_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    if vector_store is None:
        if not os.path.exists(DB_DIR):
            raise HTTPException(status_code=404, detail="Please index files first.")
        print("Loading vector store from disk...")
        vector_store = FAISS.load_local(DB_DIR, embeddings, allow_dangerous_deserialization=True)

    retriever = vector_store.as_retriever()
    relevant_docs = retriever.invoke(user_query)
    context = "\n\n".join([doc.page_content for doc in relevant_docs])
    
    prompt = f"Use the following context to answer the question.\n\nContext:\n{context}\n\nQuestion: {user_query}\n\nAnswer:"
    response = llm.invoke(prompt)
    sources = list(set(os.path.basename(doc.metadata.get("source", "")) for doc in relevant_docs))
    return {"answer": response, "sources": sources}

print("--- Starting OfflineGenie Backend Server ---")
