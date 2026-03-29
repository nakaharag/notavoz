import React, { useState, useEffect, useRef } from 'react';
import './AppStyles.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Navigation state
  const [activeTab, setActiveTab] = useState('nova');
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Recording state
  const [transcript, setTranscript] = useState('');
  const [correctedTranscript, setCorrectedTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [patientName, setPatientName] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  // Audio analyzer refs
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Records state
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Messages
  const [message, setMessage] = useState(null);

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Check for existing auth on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
    }
  }, []);

  // Load records when authenticated and on history tab
  useEffect(() => {
    if (isAuthenticated && activeTab === 'historico') {
      loadRecords();
    }
  }, [isAuthenticated, activeTab]);

  // Auto-hide messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Cleanup audio analyzer on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  });

  // ==================== AUDIO LEVEL MONITORING ====================
  const startAudioLevelMonitoring = (audioStream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);

    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (!analyserRef.current) return;

      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(Math.min(100, (average / 128) * 100));

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  const stopAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // ==================== AUTH ====================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Usuario ou senha incorretos');
      }

      const data = await response.json();
      localStorage.setItem('authToken', data.token);
      setAuthToken(data.token);
      setIsAuthenticated(true);
      setUsername('');
      setPassword('');
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setAuthToken(null);
    setIsAuthenticated(false);
    setActiveTab('nova');
    clearForm();
  };

  // ==================== RECORDING ====================
  const handleStartRecording = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage({ type: 'error', text: 'Seu navegador nao suporta gravacao de audio.' });
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((newStream) => {
        const newMediaRecorder = new MediaRecorder(newStream);
        const audioChunks = [];

        newMediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        newMediaRecorder.onstop = async () => {
          stopAudioLevelMonitoring();
          await processRecording(audioChunks);
        };

        newMediaRecorder.start();
        setMediaRecorder(newMediaRecorder);
        setStream(newStream);
        setRecording(true);
        startAudioLevelMonitoring(newStream);
      })
      .catch((error) => {
        console.error('Error accessing microphone:', error);
        setMessage({ type: 'error', text: 'Erro ao acessar o microfone. Verifique as permissoes.' });
      });
  };

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setRecording(false);
    stopAudioLevelMonitoring();
  };

  const processRecording = async (audioChunks) => {
    setIsProcessing(true);
    setProcessingStep('Transcrevendo audio...');

    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      // Step 1: Transcribe
      const transcribeResponse = await fetch(`${API_URL}/speech/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro na transcricao do audio');
      }

      const transcribeData = await transcribeResponse.json();
      setTranscript(transcribeData.transcription);

      // Step 2: Process with Claude (correct + summarize)
      setProcessingStep('Processando com IA...');
      const reportResponse = await fetch(`${API_URL}/report/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: transcribeData.transcription }),
      });

      if (!reportResponse.ok) {
        const errorData = await reportResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao processar com IA');
      }

      const reportData = await reportResponse.json();
      setCorrectedTranscript(reportData.correctedTranscript || transcribeData.transcription);
      setSummary(reportData.summary || '');
      setNotes(reportData.correctedTranscript || transcribeData.transcription);

    } catch (error) {
      console.error('Processing failed:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // ==================== RECORDS ====================
  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const response = await fetch(`${API_URL}/records`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Erro ao carregar registros');

      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error('Failed to load records:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar registros' });
    } finally {
      setLoadingRecords(false);
    }
  };

  const saveRecord = async () => {
    if (!correctedTranscript && !notes) {
      setMessage({ type: 'error', text: 'Nao ha conteudo para salvar' });
      return;
    }

    try {
      const recordData = {
        patientName: patientName || 'Paciente nao identificado',
        rawTranscript: transcript,
        correctedTranscript: correctedTranscript,
        summary: summary,
        notes: notes,
      };

      const response = await fetch(`${API_URL}/records`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(recordData),
      });

      if (!response.ok) throw new Error('Erro ao salvar registro');

      setMessage({ type: 'success', text: 'Registro salvo com sucesso!' });
      clearForm();
      setActiveTab('historico');
      loadRecords();
    } catch (error) {
      console.error('Failed to save record:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const updateRecord = async () => {
    if (!selectedRecord) return;

    try {
      const recordData = {
        patientName: patientName,
        notes: notes,
      };

      const response = await fetch(`${API_URL}/records/${selectedRecord.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(recordData),
      });

      if (!response.ok) throw new Error('Erro ao atualizar registro');

      setMessage({ type: 'success', text: 'Registro atualizado!' });
      loadRecords();
    } catch (error) {
      console.error('Failed to update record:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const confirmDelete = (record) => {
    setRecordToDelete(record);
    setShowDeleteModal(true);
  };

  const deleteRecord = async () => {
    if (!recordToDelete) return;

    try {
      const response = await fetch(`${API_URL}/records/${recordToDelete.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error('Erro ao excluir registro');

      setMessage({ type: 'success', text: 'Registro excluido' });
      setShowDeleteModal(false);
      setRecordToDelete(null);
      setSelectedRecord(null);
      loadRecords();
    } catch (error) {
      console.error('Failed to delete record:', error);
      setMessage({ type: 'error', text: error.message });
    }
  };

  const viewRecord = (record) => {
    setSelectedRecord(record);
    setPatientName(record.patientName || '');
    setTranscript(record.rawTranscript || '');
    setCorrectedTranscript(record.correctedTranscript || '');
    setSummary(record.summary || '');
    setNotes(record.notes || '');
  };

  // ==================== AUDIO PLAYBACK (Browser Speech Synthesis - Free) ====================
  const playText = (text) => {
    if (!text) return;

    // Check if browser supports speech synthesis
    if (!('speechSynthesis' in window)) {
      setMessage({ type: 'error', text: 'Seu navegador nao suporta sintese de voz.' });
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    // Try to find a Portuguese voice
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(voice => voice.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setMessage({ type: 'error', text: 'Erro ao reproduzir audio' });
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePlayReport = () => {
    playText(notes || correctedTranscript || transcript);
  };

  // ==================== HELPERS ====================
  const clearForm = () => {
    setTranscript('');
    setCorrectedTranscript('');
    setSummary('');
    setNotes('');
    setPatientName('');
    setSelectedRecord(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ==================== LOGIN PAGE ====================
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-brand">
            <img src="/logo.svg" alt="NotaVoz" className="login-logo" />
            <h1 className="login-title">NotaVoz</h1>
          </div>
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="btn btn-primary btn-full">
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== MAIN APP ====================
  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <img src="/logo.svg" alt="NotaVoz" className="header-logo" />
          <h1 className="header-title">NotaVoz</h1>
        </div>
        <div className="header-user">
          <button className="logout-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {/* Messages */}
      {message && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Navigation Tabs */}
      {!selectedRecord && (
        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'nova' ? 'active' : ''}`}
            onClick={() => setActiveTab('nova')}
          >
            Nova Consulta
          </button>
          <button
            className={`nav-tab ${activeTab === 'historico' ? 'active' : ''}`}
            onClick={() => setActiveTab('historico')}
          >
            Historico
          </button>
        </nav>
      )}

      {/* New Consultation Tab */}
      {activeTab === 'nova' && !selectedRecord && (
        <>
          {/* Patient Name */}
          <div className="patient-input-container">
            <input
              type="text"
              className="patient-input"
              placeholder="Nome do paciente (opcional)"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>

          {/* Recording Section */}
          <div className="recording-section">
            <div className="record-button-container">
              {!recording ? (
                <button
                  className="record-button start"
                  onClick={handleStartRecording}
                  disabled={isProcessing}
                >
                  <svg className="record-icon" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="9" y="2" width="6" height="12" rx="3"/>
                    <path d="M5 10v1a7 7 0 0014 0v-1M12 18v4M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                  </svg>
                  Gravar
                </button>
              ) : (
                <button
                  className="record-button stop"
                  onClick={handleStopRecording}
                >
                  <svg className="record-icon" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                  </svg>
                  Parar
                </button>
              )}
            </div>

            {/* Audio Level Indicator - Waveform */}
            {recording && (
              <div className="audio-waveform-container">
                <div className="audio-waveform">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="waveform-bar"
                      style={{
                        height: `${Math.max(15, Math.min(100, audioLevel * (0.5 + Math.random())))}%`,
                        animationDelay: `${i * 0.05}s`
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className={`recording-status ${recording ? 'active' : ''}`}>
              {recording
                ? 'Gravando... Clique em Parar quando terminar.'
                : 'Clique no botao para iniciar a gravacao.'}
            </p>
          </div>

          {/* Processing Loader */}
          {isProcessing && (
            <div className="content-box">
              <div className="loader-container">
                <div className="loader"></div>
                <p className="loader-text">{processingStep}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {!isProcessing && (correctedTranscript || summary) && (
            <>
              {/* Summary */}
              {summary && (
                <div className="content-box content-box-ai">
                  <div className="content-box-header">
                    <h2 className="content-box-title">
                      <span className="ai-indicator">&#10024;</span>
                      Resumo
                    </h2>
                    <button className="play-btn" onClick={() => playText(summary)} title="Ouvir">
                      <span className="play-icon">&#9658;</span>
                    </button>
                  </div>
                  <div className="text-display">{summary}</div>
                </div>
              )}

              {/* Original Transcription */}
              {transcript && (
                <div className="content-box">
                  <div className="content-box-header">
                    <h2 className="content-box-title">Transcricao Original</h2>
                    <button className="play-btn" onClick={() => playText(transcript)} title="Ouvir">
                      <span className="play-icon">&#9658;</span>
                    </button>
                  </div>
                  <div className="text-display">{transcript}</div>
                </div>
              )}

              {/* Editable Notes */}
              <div className="content-box content-box-ai">
                <div className="content-box-header">
                  <h2 className="content-box-title">
                    <span className="ai-indicator">&#10024;</span>
                    Notas da Consulta
                  </h2>
                  <button className="play-btn" onClick={() => playText(notes)} title="Ouvir">
                    <span className="play-icon">&#9658;</span>
                  </button>
                </div>
                <textarea
                  className="text-area"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Edite as notas aqui..."
                />
              </div>

              {/* Action Buttons */}
              <div className="action-buttons">
                <button className="btn btn-success" onClick={saveRecord}>
                  Salvar Registro
                </button>
                <button className="btn btn-neutral" onClick={clearForm}>
                  Limpar
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === 'historico' && !selectedRecord && (
        <>
          {loadingRecords ? (
            <div className="content-box">
              <div className="loader-container">
                <div className="loader"></div>
                <p className="loader-text">Carregando registros...</p>
              </div>
            </div>
          ) : records.length === 0 ? (
            <div className="records-empty">
              Nenhum registro encontrado.
            </div>
          ) : (
            <div className="records-list">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="record-card"
                  onClick={() => viewRecord(record)}
                >
                  <div className="record-card-header">
                    <div>
                      <div className="record-card-date">
                        {formatDate(record.createdAt)}
                      </div>
                      <div className="record-card-time">
                        {formatTime(record.createdAt)}
                      </div>
                    </div>
                    {record.patientName && (
                      <span className="record-card-patient">
                        {record.patientName}
                      </span>
                    )}
                  </div>
                  <p className="record-card-preview">
                    {record.summary || record.notes || record.correctedTranscript || 'Sem conteudo'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Record Detail View */}
      {selectedRecord && (
        <div className="record-detail">
          <button
            className="back-button"
            onClick={() => {
              setSelectedRecord(null);
              clearForm();
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Voltar
          </button>

          <div className="record-meta">
            <span className="record-meta-item">
              <strong>Data:</strong> {formatDate(selectedRecord.createdAt)}
            </span>
            <span className="record-meta-item">
              <strong>Hora:</strong> {formatTime(selectedRecord.createdAt)}
            </span>
          </div>

          {/* Patient Name */}
          <div className="patient-input-container">
            <input
              type="text"
              className="patient-input"
              placeholder="Nome do paciente"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </div>

          {/* Summary */}
          {summary && (
            <div className="content-box content-box-ai">
              <div className="content-box-header">
                <h2 className="content-box-title">
                  <span className="ai-indicator">&#10024;</span>
                  Resumo
                </h2>
                <button className="play-btn" onClick={() => playText(summary)} title="Ouvir">
                  <span className="play-icon">&#9658;</span>
                </button>
              </div>
              <div className="text-display">{summary}</div>
            </div>
          )}

          {/* Notes */}
          <div className="content-box content-box-ai">
            <div className="content-box-header">
              <h2 className="content-box-title">
                <span className="ai-indicator">&#10024;</span>
                Notas da Consulta
              </h2>
              <button className="play-btn" onClick={() => playText(notes)} title="Ouvir">
                <span className="play-icon">&#9658;</span>
              </button>
            </div>
            <textarea
              className="text-area"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Original Transcript */}
          {transcript && (
            <div className="content-box">
              <div className="content-box-header">
                <h2 className="content-box-title">Transcricao Original</h2>
                <button className="play-btn" onClick={() => playText(transcript)} title="Ouvir">
                  <span className="play-icon">&#9658;</span>
                </button>
              </div>
              <div className="text-display">{transcript}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="btn btn-success" onClick={updateRecord}>
              Salvar Alteracoes
            </button>
            <button
              className="btn btn-danger"
              onClick={() => confirmDelete(selectedRecord)}
            >
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h2 className="modal-title">Confirmar Exclusao</h2>
            <p className="modal-message">
              Tem certeza que deseja excluir este registro? Esta acao nao pode ser desfeita.
            </p>
            <div className="modal-buttons">
              <button
                className="btn btn-neutral"
                onClick={() => {
                  setShowDeleteModal(false);
                  setRecordToDelete(null);
                }}
              >
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={deleteRecord}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
