# 🧞‍♂️ OfflineGenie  
### Your 100% Private, Offline-First RAG (Retrieval-Augmented Generation) Application  

![Static Badge](https://img.shields.io/badge/Built%20With-FastAPI-blue?style=flat-square)
![Static Badge](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-green?style=flat-square)
![Static Badge](https://img.shields.io/badge/LLM-Llama%203-orange?style=flat-square)
![Static Badge](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

---

## 🧩 Overview  

**OfflineGenie** is a full-stack, **local-first RAG (Retrieval-Augmented Generation)** app.  
It allows you to upload your personal documents (PDFs, CSVs, etc.) and chat with them using a **powerful large language model running entirely on your machine**.  

🛡️ **Your files and conversations never leave your computer**, ensuring 100% privacy.

---

## ✨ Core Features  

- ⚡ **100% Offline RAG** — Entire chat and indexing pipeline (file parsing, embedding, and generation) runs locally.  
- 🧠 **Local LLM Integration** — Powered by **Llama 3** (or any compatible model) via **Ollama**.  
- 🔒 **Private & Secure** — No data ever leaves your system.  
- 📚 **Multimodel File Support** — Processes **PDFs** and **CSVs** effortlessly.  
- 🖥️ **Modern UI** — Built with **React + Tailwind CSS** with light/dark modes.  
- 🌐 *(Optional)* **Online Enhancements (via Gemini API):**  
  - ✨ Document Summarization  
  - ✨ Query Augmentation  
  - ✨ Insight Extraction  

---

## 🛠️ Tech Stack  

| Component | Technology |
|------------|-------------|
| **Frontend** | React, Tailwind CSS, Lucide-React |
| **Backend** | Python 3, FastAPI |
| **AI Orchestration** | LangChain |
| **Local LLM** | Ollama (serving Llama 3) |
| **Embedding Model** | all-MiniLM-L6-v2 (Sentence Transformers) |
| **Vector Database** | FAISS (Facebook AI Similarity Search) |

---

## 🚀 Getting Started  

### 🧰 Prerequisites  

You must have the following installed:
- [Node.js](https://nodejs.org/) (LTS version recommended)  
- [Python 3.10+](https://www.python.org/downloads/)  
- [Ollama](https://ollama.com)  

Pull the **Llama 3** model:  
```bash
ollama pull llama3

⚙️ Installation & Setup
1️⃣ Clone the Repository

git clone https://github.com/YourUsername/OfflineGenie.git
cd OfflineGenie


2️⃣ Start the Backend Server (Terminal 1)
cd backend
python -m venv venv

Install dependencies:
pip install -r requirements.txt

Run the FastAPI server:
python -m uvicorn main:app --reload

Backend available at → http://127.0.0.1:8000

3️⃣ Start the Frontend App (Terminal 2)
cd frontend
npm install
npm start

Frontend available at → http://localhost:3000

📁 Folder Structure
OfflineGenie/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── models/
│   ├── routes/
│   └── utils/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── App.jsx
│   ├── package.json
│   └── tailwind.config.js
│
└── README.md

💡 How It Works

Upload Document — PDFs/CSVs are parsed locally.

Generate Embeddings — Each text chunk is converted into vectors via Sentence Transformers.

Store in FAISS — Embeddings stored locally for fast retrieval.

Ask a Question — User query converted into vector and matched.

RAG Pipeline — Retrieved chunks + query → sent to Llama 3.

AI Response — Generated locally and displayed in chat UI.

