'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TRANSLATIONS } from '../../lib/i18n';

export const AiAnalystView: React.FC = () => {
  const { currentCompany, chatMessages, sendAiMessage, language, t } = useApp();
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSubmitting) return;
    const q = inputText.trim();
    setInputText('');
    setIsSubmitting(true);
    await sendAiMessage(q);
    setIsSubmitting(false);
  };

  const handleChipClick = async (question: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    await sendAiMessage(question);
    setIsSubmitting(false);
  };

  const activeDict = TRANSLATIONS[language] || TRANSLATIONS.en;
  const suggestedQuestions = activeDict.suggestedQuestions;

  return (
    <div className="card">
      <h2>{t('aiTitle')}</h2>
      <div className="sub" style={{ marginBottom: '10px' }}>
        {t('aiSubtitle', { name: currentCompany.n })}
      </div>

      <div className="chat" id="chat">
        {chatMessages.length === 0 ? (
          <div className="sub" style={{ padding: '8px 0' }}>
            {t('aiEmptyPrompt')}
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <div key={idx} className={`m ${msg.r}`}>
              <div>{msg.t}</div>
              {msg.s && (
                <span className="src">
                  {t('sourcePrefix')}{msg.s}
                </span>
              )}
            </div>
          ))
        )}
        <div ref={chatBottomRef} />
      </div>

      <div className="row" style={{ marginBottom: '10px' }}>
        {suggestedQuestions.map((q, idx) => (
          <span
            key={idx}
            className="chip"
            onClick={() => handleChipClick(q)}
            role="button"
            tabIndex={0}
          >
            {q}
          </span>
        ))}
      </div>

      <form className="row" onSubmit={handleSubmit}>
        <input
          id="qi"
          placeholder={t('askInputPlaceholder')}
          style={{ flex: 1, minWidth: '200px' }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isSubmitting}
        />
        <button className="btn" type="submit" disabled={isSubmitting || !inputText.trim()}>
          {isSubmitting ? t('thinking') : t('askButton')}
        </button>
      </form>
    </div>
  );
};
