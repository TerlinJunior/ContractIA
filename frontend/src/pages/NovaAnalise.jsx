import React, { useState } from 'react';
import { UploadCloud, FileText, Loader2, AlertCircle, CheckCircle, Scale, XCircle, HelpCircle } from 'lucide-react';

const NovaAnalise = () => {
  const [textos, setTextos] = useState({ nomeLicitacao: '', numeroProcesso: '' });
  const [arquivos, setArquivos] = useState({ edital: null, proposta: null });
  const [status, setStatus] = useState('idle');
  const [mensagem, setMensagem] = useState('');
  const [resultado, setResultado] = useState(null);
  const [planilha, setPlanilha] = useState(null); // Estado da planilha já estava aqui!

  const handleTextChange = (e) => setTextos({ ...textos, [e.target.name]: e.target.value });

  const handleFileChange = (e, tipo) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setArquivos({ ...arquivos, [tipo]: file });
    } else {
      alert('Por favor, selecione apenas arquivos PDF.');
      e.target.value = null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!arquivos.edital || !arquivos.proposta) {
      setStatus('error');
      setMensagem('Por favor, anexe o Edital e a Proposta para continuar.');
      return;
    }

    setStatus('loading');
    setMensagem('Motor IA analisando e comparando documentos...');
    setResultado(null);

    const formData = new FormData();
    formData.append('nomeLicitacao', textos.nomeLicitacao);
    formData.append('numeroProcesso', textos.numeroProcesso);
    formData.append('edital', arquivos.edital);
    formData.append('proposta', arquivos.proposta);
    
    // Adiciona a planilha ao envio se o usuário tiver anexado
    if (planilha) {
      formData.append('planilha', planilha);
    }

    try {
      const response = await fetch('http://localhost:8000/api/analises/iniciar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMensagem(data.mensagem);
        setResultado(data.dados); // Salva o JSON da comparação
      } else {
        setStatus('error');
        setMensagem(data.erro || 'Erro ao processar os arquivos.');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMensagem('Não foi possível conectar ao servidor.');
    }
  };

  // Função para renderizar a tag de status colorida
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'ATENDE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 font-semibold text-xs border border-green-200">
            <CheckCircle size={14} /> ATENDE
          </span>
        );
      case 'NÃO ATENDE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 font-semibold text-xs border border-red-200">
            <XCircle size={14} /> NÃO ATENDE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold text-xs border border-amber-200">
            <HelpCircle size={14} /> NÃO MENCIONADO
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Nova Análise Comparativa</h1>
        <p className="text-slate-500 mt-2">Valide automaticamente se a Proposta cumpre as exigências do Edital.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nome/Objeto da Licitação</label>
              <input type="text" name="nomeLicitacao" required value={textos.nomeLicitacao} onChange={handleTextChange} placeholder="Ex: Aquisição de TI" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Número do Processo</label>
              <input type="text" name="numeroProcesso" required value={textos.numeroProcesso} onChange={handleTextChange} placeholder="Ex: Pregão 014/2026" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Grid alterado para 3 colunas para caber a planilha */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">1. Edital (Regras)</label>
              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${arquivos.edital ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:bg-slate-50 bg-white'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {arquivos.edital ? <FileText className="w-8 h-8 text-blue-500 mb-2" /> : <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />}
                  <p className="text-sm text-slate-500 font-semibold">{arquivos.edital ? arquivos.edital.name : 'Anexar Edital (PDF)'}</p>
                </div>
                <input type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e, 'edital')} />
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">2. Proposta Comercial</label>
              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${arquivos.proposta ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50 bg-white'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {arquivos.proposta ? <FileText className="w-8 h-8 text-indigo-500 mb-2" /> : <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />}
                  <p className="text-sm text-slate-500 font-semibold">{arquivos.proposta ? arquivos.proposta.name : 'Anexar Proposta (PDF)'}</p>
                </div>
                <input type="file" className="hidden" accept="application/pdf" onChange={(e) => handleFileChange(e, 'proposta')} />
              </label>
            </div>

            {/* Novo Box de Upload para Planilha */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">3. Planilha (Opcional)</label>
              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${planilha ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:bg-slate-50 bg-white'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {planilha ? <FileText className="w-8 h-8 text-emerald-500 mb-2" /> : <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />}
                  <p className="text-sm text-slate-500 font-semibold text-center px-2 truncate w-full">{planilha ? planilha.name : 'Anexar Custos (.xlsx)'}</p>
                </div>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => setPlanilha(e.target.files[0])} />
              </label>
            </div>
          </div>

          {status !== 'idle' && (
            <div className={`p-4 rounded-lg flex items-center gap-3 ${status === 'loading' ? 'bg-blue-50 text-blue-700' : status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {status === 'loading' && <Loader2 className="animate-spin" size={20} />}
              {status === 'success' && <CheckCircle size={20} />}
              {status === 'error' && <AlertCircle size={20} />}
              <span className="font-medium">{mensagem}</span>
            </div>
          )}

          <div className="pt-2">
            <button type="submit" disabled={status === 'loading'} className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-semibold py-4 rounded-xl flex justify-center items-center gap-2 transition-colors">
              {status === 'loading' ? <><Loader2 className="animate-spin" size={20} /> Cruzando dados...</> : 'Iniciar Comparação Inteligente'}
            </button>
          </div>
        </form>
      </div>

      {/* RESULTADO DA COMPARAÇÃO */}
      {resultado && resultado.resultados_comparacao && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
            <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
              <Scale size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Resultado da Auditoria</h2>
              <p className="text-slate-500 text-sm mt-1">Comparação detalhada entre as exigências do Edital e as ofertas da Proposta.</p>
            </div>
          </div>

          <div className="grid gap-6">
            {resultado.resultados_comparacao.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
                {/* Cabeçalho do Card */}
                <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Requisito Auditado</span>
                    <span className="text-lg font-bold text-slate-800">{item.requisito}</span>
                  </div>
                  <div>
                    {renderStatusBadge(item.status)}
                  </div>
                </div>
                
                {/* Corpo do Card: A Comparação */}
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* Lado do Edital */}
                  <div className="p-6 bg-white">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <h4 className="font-semibold text-slate-700">Exigência do Edital</h4>
                    </div>
                    <div className="mb-3">
                      <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm font-medium">
                        Valor Mínimo/Exato: {item.exigencia_edital}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                      "{item.trecho_edital}"
                    </p>
                  </div>

                  {/* Lado da Proposta */}
                  <div className="p-6 bg-white">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <h4 className="font-semibold text-slate-700">O que diz a Proposta</h4>
                    </div>
                    <p className={`text-sm p-3 rounded-lg border ${
                      item.status === 'ATENDE' ? 'bg-green-50/50 border-green-100 text-green-800' :
                      item.status === 'NÃO ATENDE' ? 'bg-red-50/50 border-red-100 text-red-800' :
                      'bg-amber-50/50 border-amber-100 text-amber-800'
                    }`}>
                      {item.evidencia_proposta ? `"${item.evidencia_proposta}"` : "Nenhum trecho correspondente encontrado na proposta."}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NovaAnalise;