import os
import json
import datetime
from sqlalchemy.orm import Session
import models

# Lazy loaded embeddings model
_model = None

def get_embeddings_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        print("[RAG Service] Loading all-MiniLM-L6-v2 model...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model

def chunk_text(text: str, chunk_size: int = 150, overlap: int = 30) -> list[str]:
    """Split report text into overlapping chunk segments."""
    words = text.split()
    chunks = []
    if len(words) <= chunk_size:
        return [text]
        
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks

def index_report(db: Session, report_id: int, user_id: int, report_text: str):
    """Chunk report text, generate embeddings, and store them in the database."""
    chunks = chunk_text(report_text)
    if not chunks:
        return
        
    model = get_embeddings_model()
    embeddings = model.encode(chunks)
    
    # Delete existing embeddings for this report first to avoid duplicates
    db.query(models.ReportEmbedding).filter(
        models.ReportEmbedding.report_id == report_id
    ).delete()
    
    for chunk, emb in zip(chunks, embeddings):
        db_emb = models.ReportEmbedding(
            report_id=report_id,
            user_id=user_id,
            chunk_text=chunk,
            embedding=emb.tolist() # converts np.array to list of float
        )
        db.add(db_emb)
    db.commit()
    print(f"[RAG Service] Indexed report ID: {report_id} with {len(chunks)} chunks.")

def retrieve_relevant_chunks(db: Session, user_id: int, query: str, top_k: int = 5, report_id: int = None) -> list[dict]:
    """Search FAISS index over user's report chunk embeddings to find top relevant contexts."""
    query_filter = [models.ReportEmbedding.user_id == user_id]
    if report_id is not None:
        query_filter.append(models.ReportEmbedding.report_id == report_id)
    db_embeddings = db.query(models.ReportEmbedding).filter(*query_filter).all()
    if not db_embeddings:
        return []
        
    model = get_embeddings_model()
    query_vector = model.encode([query]).astype('float32')
    
    import faiss
    import numpy as np
    
    embeddings_list = []
    records = []
    for r in db_embeddings:
        try:
            emb_val = r.embedding
            if isinstance(emb_val, str):
                emb_val = json.loads(emb_val)
            embeddings_list.append(emb_val)
            records.append({
                "report_id": r.report_id,
                "chunk_text": r.chunk_text,
                "created_at": r.created_at
            })
        except Exception as e:
            print(f"[RAG Service] Error loading embedding {r.id}: {e}")
            continue
            
    if not embeddings_list:
        return []
        
    embeddings_matrix = np.array(embeddings_list).astype('float32')
    
    # 384 is the size of all-MiniLM-L6-v2 vectors
    index = faiss.IndexFlatL2(384)
    index.add(embeddings_matrix)
    
    k = min(top_k, len(embeddings_list))
    distances, indices = index.search(query_vector, k)
    
    results = []
    for idx in indices[0]:
        if idx >= 0 and idx < len(records):
            results.append(records[idx])
    return results
