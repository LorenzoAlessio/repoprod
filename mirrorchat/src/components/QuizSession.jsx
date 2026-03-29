import { useState, useEffect } from 'react';
import { generateQuiz } from '../utils/api';
import { getSavedChatTags, getProblematicContext } from '../utils/chatStorage';
import styles from './QuizSession.module.css';

export default function QuizSession({ onComplete }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quizData, setQuizData] = useState(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);

  useEffect(() => {
    async function initQuiz() {
      try {
        const tags = getSavedChatTags();
        if (!tags || tags.length === 0) {
          setError('Non hai ancora chat salvate o non sono state rilevate problematiche sufficienti per generare un quiz.');
          setLoading(false);
          return;
        }

        const contexts = getProblematicContext();
        const data = await generateQuiz(tags, contexts);
        setQuizData(data);
      } catch (err) {
        setError(err.message || 'Errore durante la creazione del quiz.');
      } finally {
        setLoading(false);
      }
    }
    initQuiz();
  }, []);

  const handleOptionClick = (idx) => {
    if (selectedOption !== null) return; // Prevent double clicks
    setSelectedOption(idx);
  };

  const handleNext = () => {
    if (currentQuestionIndex < quizData.domande.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
    } else {
      // Finished
      if (onComplete) onComplete();
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingWrapper}>
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }}></span>
          <p className={styles.loadingText}>L'intelligenza artificiale sta preparando una serie di riflessioni basate sulle dinamiche delle tue conversazioni...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.container} ${styles.errorContainer}`}>
        <p className={styles.errorText}>⚠ {error}</p>
        <button className="btn btn--outline" onClick={onComplete}>Torna indietro</button>
      </div>
    );
  }

  if (!quizData || !quizData.domande || quizData.domande.length === 0) {
    return (
      <div className={styles.container}>
        <p>Impossibile caricare le domande al momento.</p>
        <button className="btn btn--outline" onClick={onComplete}>Torna indietro</button>
      </div>
    );
  }

  const question = quizData.domande[currentQuestionIndex];
  const isFinished = currentQuestionIndex === quizData.domande.length - 1 && selectedOption !== null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>{quizData.titolo || "Quiz di Condivisione"}</h2>
        <p className={styles.progress}>Domanda {currentQuestionIndex + 1} di {quizData.domande.length}</p>
      </header>
      
      {currentQuestionIndex === 0 && selectedOption === null && quizData.introduzione && (
        <p className={styles.intro}>{quizData.introduzione}</p>
      )}

      <div className={styles.questionCard}>
        <h3 className={styles.questionText}>{question.testo}</h3>

        <div className={styles.optionsList}>
          {question.opzioni.map((opt, idx) => {
            let itemClass = styles.optionItem;
            
            if (selectedOption !== null) {
              if (idx === question.risposta_corretta_index) {
                itemClass += ` ${styles.optionCorrect}`;
              } else if (idx === selectedOption) {
                itemClass += ` ${styles.optionWrong}`;
              } else {
                itemClass += ` ${styles.optionDisabled}`;
              }
            }

            return (
              <button
                key={idx}
                className={itemClass}
                onClick={() => handleOptionClick(idx)}
                disabled={selectedOption !== null}
              >
                <div className={styles.optionLetter}>{String.fromCharCode(65 + idx)}</div>
                <div className={styles.optionText}>{opt}</div>
              </button>
            );
          })}
        </div>

        {selectedOption !== null && (
          <div className={`${styles.explanationBox} page-enter`}>
            <h4 className={styles.explanationTitle}>
              {selectedOption === question.risposta_corretta_index ? '✨ Risposta corretta e Spunto di riflessione:' : '💡 Spunto di riflessione:'}
            </h4>
            <p className={styles.explanationText}>{question.spiegazione}</p>

            <button className={`btn btn--aurora ${styles.nextBtn}`} onClick={handleNext}>
              {isFinished ? 'Termina Analisi' : 'Prossima riflessione'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
