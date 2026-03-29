import { useState, useRef, useEffect } from 'react';
import styles from './SafePlacesChatbot.module.css';

export default function SafePlacesChatbot({ places, onSelectPlace }) {
  const [messages, setMessages] = useState([
    { 
      role: 'ai', 
      text: 'Ciao. Se ti trovi in pericolo o non ti senti al sicuro, scrivimi cosa succede e cercherò di indicarti il posto più adatto dove chiedere aiuto.' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/places/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, places })
      });

      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.text,
        recommendedPlaceId: data.recommendedPlaceId || null,
        reason: data.reason || null
      }]);

      if (data.recommendedPlaceId) {
        onSelectPlace(data.recommendedPlaceId);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Errore di connessione. Se sei in emergenza grave chiama subito il 112 o il 1522.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={styles.chatContainer}>
      <header className={styles.chatHeader}>
        <h2><span>🤖</span> Assistente Sicurezza</h2>
      </header>

      <div className={styles.chatMessages}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.messageRow} ${styles[msg.role]}`}>
            <div className={styles.messageBubble}>
              <div>{msg.text}</div>
              
              {msg.recommendedPlaceId && (
                <div 
                  className={styles.recommendationCard}
                  onClick={() => onSelectPlace(msg.recommendedPlaceId)}
                >
                  <div className={styles.placeName}>📍 Posto Consigliato</div>
                  <div className={styles.placeDetail}><strong>Motivo:</strong> {msg.reason}</div>
                  <div className={styles.placeDetail}>Cerca il pin sulla mappa per maggiori dettagli (orari, telefono).</div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className={`${styles.messageRow} ${styles.ai}`}>
            <div className={styles.messageBubble} style={{ opacity: 0.7 }}>
              Sto cercando la migliore soluzione...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className={styles.chatInputArea} onSubmit={handleSend}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Come ti senti? Dove sei?" 
          className={styles.chatInput}
          disabled={isTyping}
        />
        <button type="submit" className={styles.sendBtn} disabled={!input.trim() || isTyping}>
          <svg style={{width:'20px',height:'20px', fill:'white'}} viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
