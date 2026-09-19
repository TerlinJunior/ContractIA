import React, { useState, useEffect } from 'react';
import { Database, Loader2, Calendar, FileText, CheckCircle, ArrowLeft, Scale, XCircle, HelpCircle, MessageSquare, Send, User, Bot, Paperclip } from 'lucide-react';

const Dashboard = () => {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Novo estado para controlar a tela de detalhes
  const [analiseSelecionada, setAnaliseSelecionada] = useState(null);

  // --- NOVOS ESTADOS DO CHAT ---
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [arquivoChat, setArquivoChat] = useState(null); // Estado para o novo PDF
  const [carregandoChat, setCarregandoChat] = useState(false);

  useEffect(() => {
    const buscarHistorico = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/analises/historico');
        const data = await response.json();
        if (response.ok) {
          setHistorico(data);
        }
      } catch (error) {
        console.error('Erro ao buscar histórico:', error);
      } finally {
        setLoading(false);
      }
    };

    buscarHistorico();
  }, []);

  const formatarData = (dataIso) => {
    return new Date(dataIso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const enviarMensagem = async (e) => {
    e.preventDefault();
    if (!novaMensagem.trim() && !arquivoChat) return;

    // Se mandou arquivo, avisa na tela do usuário
    const textoExibicao = arquivoChat ? `[Arquivo Anexado: ${arquivoChat.name}] ${novaMensagem}` : novaMensagem;
    const msgUsuario = { autor: 'usuario', texto: textoExibicao };
    
    setMensagens(prev => [...prev, msgUsuario]);
    
    // Empacota os dados para enviar texto + arquivo juntos
    const formData = new FormData();
    formData.append('analise_id', analiseSelecionada.id);
    formData.append('mensagem', novaMensagem || "Analise o arquivo em anexo.");
    if (arquivoChat) formData.append('documento', arquivoChat);

    setNovaMensagem('');
    setArquivoChat(null);
    setCarregandoChat(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        body: formData // Envia o FormData em vez do JSON antigo
      });
      
      const data = await response.json();
      setMensagens(prev => [...prev, { autor: 'ia', texto: data.resposta }]);
    } catch (error) {
      setMensagens(prev => [...prev, { autor: 'ia', texto: 'Erro de conexão com a IA local.' }]);
    } finally {
      setCarregandoChat(false);
    }
  };

  // Limpa o chat sempre que mudar de licitação
  // Carrega o histórico do banco de dados quando abrir a licitação
  useEffect(() => {
    if (analiseSelecionada) {
      if (analiseSelecionada.chat_historico && analiseSelecionada.chat_historico.length > 0) {
        // Se a conversa já existe no banco de dados, carrega na tela!
        setMensagens(analiseSelecionada.chat_historico);
      } else {
        // Se for a primeira vez abrindo essa análise
        setMensagens([{ autor: 'ia', texto: `Olá! Sou o ContractIA. O que você gostaria de saber sobre o processo ${analiseSelecionada.numero_processo}?` }]);
      }
    }
  }, [analiseSelecionada]);

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

  // --- TELA 2: VISUALIZAÇÃO DOS DETALHES ---
  if (analiseSelecionada) {
    const resultado = analiseSelecionada.resultado_json;
    
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
        <button 
          onClick={() => setAnaliseSelecionada(null)}
          className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium mb-4"
        >
          <ArrowLeft size={20} /> Voltar para o Histórico
        </button>

        <div>
          <h1 className="text-3xl font-bold text-slate-800">{analiseSelecionada.nome_licitacao}</h1>
          <p className="text-slate-500 mt-2">Processo: {analiseSelecionada.numero_processo} • Analisado em {formatarData(analiseSelecionada.criado_em)}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
            <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
              <Scale size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Resultado da Auditoria Salva</h2>
              <p className="text-slate-500 text-sm mt-1">Comparação detalhada registrada no banco de dados.</p>
            </div>
          </div>

          <div className="grid gap-6">
            {resultado.resultados_comparacao?.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
                <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Requisito Auditado</span>
                    <span className="text-lg font-bold text-slate-800">{item.requisito}</span>
                  </div>
                  <div>
                    {renderStatusBadge(item.status)}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
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

          {/* --- INÍCIO DA SESSÃO DE CHAT (Agora fora do laço!) --- */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mt-12">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
              <MessageSquare className="text-indigo-600" size={20} />
              <h2 className="font-bold text-slate-800">Assistente de Auditoria (Upload de Correções)</h2>
            </div>
            
            <div className="p-6 h-96 overflow-y-auto bg-slate-50 flex flex-col gap-4">
              {mensagens.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 max-w-[85%] ${msg.autor === 'usuario' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.autor === 'usuario' ? 'bg-blue-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                    {msg.autor === 'usuario' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`p-4 rounded-2xl text-sm shadow-sm ${msg.autor === 'usuario' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none whitespace-pre-wrap'}`}>
                    {msg.texto}
                  </div>
                </div>
              ))}
              {carregandoChat && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Bot size={16} />
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-tl-none flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analisando...
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              {arquivoChat && (
                <div className="mb-3 text-sm text-blue-600 font-medium flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                  <Paperclip size={16} /> Anexo pronto para envio: {arquivoChat.name}
                </div>
              )}
              <form onSubmit={enviarMensagem} className="flex gap-2 items-center">
                <label className="cursor-pointer p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors border border-slate-200" title="Anexar novo documento em PDF">
                  <Paperclip size={20} />
                  <input 
                    type="file" 
                    accept=".pdf, .xlsx, .xls"
                    className="hidden" 
                    onChange={(e) => setArquivoChat(e.target.files[0])} 
                  />
                </label>
                <input
                  type="text"
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  placeholder="Pergunte sobre os requisitos ou envie um documento corrigido..."
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-slate-50"
                  disabled={carregandoChat}
                />
                <button 
                  type="submit" 
                  disabled={carregandoChat || (!novaMensagem.trim() && !arquivoChat)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Send size={18} /> Enviar
                </button>
              </form>
            </div>
          </div>
          {/* --- FIM DA SESSÃO DE CHAT --- */}

        </div>
      </div>
    );
  }

  // --- TELA 1: TABELA DE HISTÓRICO ---
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard de Auditoria</h1>
        <p className="text-slate-500 mt-2">Histórico de todas as licitações processadas pelo ContractIA.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <Database className="text-blue-600" size={24} />
          <h2 className="text-lg font-bold text-slate-800">Análises Recentes</h2>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
            <p>Carregando histórico do banco de dados...</p>
          </div>
        ) : historico.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p>Nenhuma análise encontrada no banco de dados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                <tr>
                  <th className="px-6 py-4 font-semibold">Data da Análise</th>
                  <th className="px-6 py-4 font-semibold">Objeto da Licitação</th>
                  <th className="px-6 py-4 font-semibold">Processo</th>
                  <th className="px-6 py-4 font-semibold">Requisitos</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historico.map((item) => {
                  const qtdRequisitos = item.resultado_json.resultados_comparacao?.length || 0;
                  
                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setAnaliseSelecionada(item)}
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" /> {formatarData(item.criado_em)}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        {item.nome_licitacao}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          {item.numero_processo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-2">
                        <FileText size={14} className="text-slate-400" /> {qtdRequisitos} itens
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                          <CheckCircle size={14} /> CONCLUÍDO
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;