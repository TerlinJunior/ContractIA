from fastapi import FastAPI, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, JSON, TIMESTAMP
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from pydantic import BaseModel
import requests
import PyPDF2
import io
import pandas as pd
import json

# ==========================================
# 1. CONFIGURAÇÃO DO BANCO DE DADOS (MySQL)
# ==========================================
DATABASE_URL = "mysql+pymysql://root:@localhost/contractia"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class RequisicaoChat(BaseModel):
    analise_id: int
    mensagem: str

class AnaliseDB(Base):
    __tablename__ = "analises"
    __table_args__ = {'extend_existing': True} # <-- ESSA TRAVA RESOLVE O SEU ERRO PARA SEMPRE
    
    id = Column(Integer, primary_key=True, index=True)
    nome_licitacao = Column(String(255), nullable=False)
    numero_processo = Column(String(100), nullable=False)
    resultado_json = Column(JSON, nullable=False)
    chat_historico = Column(JSON, nullable=True)
    criado_em = Column(TIMESTAMP, server_default=func.now())

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 2. CONFIGURAÇÃO DA API (FastAPI)
# ==========================================
app = FastAPI(title="ContractIA API", description="API Local com MySQL e Ollama")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 3. ROTA DE HISTÓRICO
# ==========================================
@app.get("/api/analises/historico")
def listar_historico(db: Session = Depends(get_db)):
    historico = db.query(AnaliseDB).order_by(AnaliseDB.criado_em.desc()).all()
    resultado = []
    for item in historico:
        resultado.append({
            "id": item.id,
            "nome_licitacao": item.nome_licitacao,
            "numero_processo": item.numero_processo,
            "resultado_json": item.resultado_json,
            "chat_historico": item.chat_historico,
            "criado_em": item.criado_em
        })
    return resultado

# ==========================================
# 4. ROTA DE AUDITORIA (PDF + XLSX)
# ==========================================
@app.post("/api/analises/iniciar")
async def iniciar_analise(
    nomeLicitacao: str = Form(...),
    numeroProcesso: str = Form(...),
    edital: UploadFile = File(...),
    proposta: UploadFile = File(...),
    planilha: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    print("\n--- 1. EXTRAÇÃO DE TEXTOS E PLANILHAS ---")
    
    edital_bytes = await edital.read()
    texto_edital = "".join([pagina.extract_text() for pagina in PyPDF2.PdfReader(io.BytesIO(edital_bytes)).pages])
    
    proposta_bytes = await proposta.read()
    texto_proposta = "".join([pagina.extract_text() for pagina in PyPDF2.PdfReader(io.BytesIO(proposta_bytes)).pages])
    
    texto_planilha = "Nenhuma planilha adicional foi enviada."
    if planilha and planilha.filename:
        planilha_bytes = await planilha.read()
        try:
            df = pd.read_excel(io.BytesIO(planilha_bytes))
            texto_planilha = df.to_string(index=False)
        except Exception as e:
            texto_planilha = f"Erro ao ler a planilha: {str(e)}"
    
    texto_edital_limpo = texto_edital[:6000]
    texto_proposta_limpa = texto_proposta[:6000]
    texto_planilha_limpo = texto_planilha[:3000]

    print("\n--- 2. CHAMANDO A IA LOCAL (OLLAMA) ---")
    prompt = f"""
    Você é um auditor sênior e implacável de licitações públicas.
    Sua missão é realizar uma AUDITORIA GERAL, comparando o Edital, a Proposta e a Planilha (se houver).
    
    Identifique TODOS os requisitos cruciais.
    Você DEVE retornar APENAS um JSON válido. Siga EXATAMENTE esta estrutura:
    {{
      "resultados_comparacao": [
        {{
          "requisito": "Nome do critério",
          "status": "ATENDE" ou "NÃO ATENDE" ou "NÃO MENCIONADO",
          "exigencia_edital": "O que o Edital exige",
          "trecho_edital": "Resumo do Edital",
          "evidencia_proposta": "Como a proposta ou a planilha atende ou a falha exata"
        }}
      ]
    }}

    DOCUMENTO 1 (EDITAL):
    {texto_edital_limpo}

    DOCUMENTO 2 (PROPOSTA):
    {texto_proposta_limpa}
    
    DOCUMENTO 3 (PLANILHA DE PREÇOS/ITENS):
    {texto_planilha_limpo}
    """
    
    url_ollama = "http://localhost:11434/api/generate"
    try:
        resposta_ia = requests.post(url_ollama, json={"model": "llama3", "prompt": prompt, "stream": False, "format": "json"}).json()
        texto_ia_limpo = resposta_ia["response"].replace("```json", "").replace("```", "").strip()
        resultado_formatado = json.loads(texto_ia_limpo)
        
        if "resultados_comparacao" not in resultado_formatado:
            for chave, valor in resultado_formatado.items():
                if isinstance(valor, list):
                    resultado_formatado = {"resultados_comparacao": valor}
                    break
    except Exception as e:
        resultado_formatado = {"resultados_comparacao": [{"requisito": "Erro", "status": "NÃO ATENDE", "exigencia_edital": "N/A", "trecho_edital": "N/A", "evidencia_proposta": str(e)}]}

    print("\n--- 3. SALVANDO NO MYSQL ---")
    nova_analise = AnaliseDB(
        nome_licitacao=nomeLicitacao, 
        numero_processo=numeroProcesso, 
        resultado_json=resultado_formatado,
        chat_historico=[] 
    )
    db.add(nova_analise)
    db.commit()
    db.refresh(nova_analise)

    return {"mensagem": "Análise concluída", "dados": resultado_formatado}

# ==========================================
# 5. ROTA DO CHAT (Com Memória Permanente)
# ==========================================
@app.post("/api/chat")
async def chat_ia(
    analise_id: int = Form(...),
    mensagem: str = Form(...),
    documento: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    analise = db.query(AnaliseDB).filter(AnaliseDB.id == analise_id).first()
    if not analise: return {"resposta": "Erro: Análise não encontrada."}

    historico_atual = list(analise.chat_historico) if analise.chat_historico else []

    texto_extra = ""
    nome_arq = ""
    if documento and documento.filename:
        nome_arq = f" [Arquivo anexado: {documento.filename}]"
        doc_bytes = await documento.read()
        if documento.filename.lower().endswith('.pdf'):
            leitor = PyPDF2.PdfReader(io.BytesIO(doc_bytes))
            texto_extra = f"\n[NOVO PDF ENVIADO]:\n{''.join([p.extract_text() for p in leitor.pages])[:4000]}\n"
        elif documento.filename.lower().endswith(('.xlsx', '.xls')):
            texto_extra = f"\n[NOVA PLANILHA ENVIADA]:\n{pd.read_excel(io.BytesIO(doc_bytes)).to_string(index=False)[:4000]}\n"

    historico_atual.append({"autor": "usuario", "texto": mensagem + nome_arq})

    memoria_conversa = ""
    for msg in historico_atual[-7:-1]:
        quem = "Usuário" if msg["autor"] == "usuario" else "ContractIA"
        memoria_conversa += f"{quem}: {msg['texto']}\n"

    prompt = f"""
    Você é o ContractIA, assistente de licitações.
    
    RESULTADO DA AUDITORIA ORIGINAL: {json.dumps(analise.resultado_json, ensure_ascii=False)}
    {texto_extra}

    MEMÓRIA DA CONVERSA ANTERIOR:
    {memoria_conversa}
    
    MENSAGEM ATUAL DO USUÁRIO: {mensagem}
    
    Responda à mensagem atual. Lembre-se do contexto acima. Não use JSON.
    """
    
    url_ollama = "http://localhost:11434/api/generate"
    try:
        resposta_ia = requests.post(url_ollama, json={"model": "llama3", "prompt": prompt, "stream": False}).json()
        texto_resposta = resposta_ia["response"]
        
        historico_atual.append({"autor": "ia", "texto": texto_resposta})
        analise.chat_historico = historico_atual
        db.commit()
        
        return {"resposta": texto_resposta}
    except Exception as e:
        return {"resposta": f"Erro ao processar mensagem: {str(e)}"}