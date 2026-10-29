import React, { useEffect, useState } from 'react';
import { authService, type SecurityQuestion } from '../../../../services/authService';

const SecurityQuestionSection: React.FC = () => {
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [status, setStatus] = useState<{ has_question: boolean; question: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([authService.getSecurityQuestions(), authService.getSecurityQuestionStatus()])
      .then(([availableQuestions, questionStatus]) => {
        if (active) {
          setQuestions(availableQuestions);
          setStatus(questionStatus);
          setSelectedQuestion(questionStatus.question || '');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'Unable to load security question settings.',
          });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      await authService.updateSecurityQuestion({
        current_password: currentPassword,
        question: selectedQuestion,
        answer,
      });
      setStatus({ has_question: true, question: selectedQuestion });
      setAnswer('');
      setCurrentPassword('');
      setMessage({ type: 'success', text: 'Security question saved successfully.' });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to save your security question.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mt-8 border-t border-gray-200 pt-6" aria-labelledby="security-question-heading">
      <h3 id="security-question-heading" className="text-lg font-semibold text-gray-800">Security question</h3>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Used to recover your account if you forget your password.
      </p>

      {message && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}
          role={message.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message.text}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500" role="status">Loading security question settings...</p>
      ) : (
        <>
          {status && (
            <p className="mb-4 text-sm text-gray-600" role="status">
              {status.has_question ? 'A security question is set.' : 'No security question is set.'}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="security-question-select" className="mb-1 block text-sm font-medium text-gray-700">
                Question
              </label>
              <select
                id="security-question-select"
                required
                value={selectedQuestion}
                onChange={(event) => setSelectedQuestion(event.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20"
              >
                <option value="" disabled>Select a question</option>
                {questions.map((question) => (
                  <option key={question.id} value={question.id}>{question.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="security-question-answer" className="mb-1 block text-sm font-medium text-gray-700">
                Answer
              </label>
              <input
                id="security-question-answer"
                type="text"
                required
                minLength={3}
                maxLength={100}
                autoComplete="off"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20"
              />
            </div>
            <div>
              <label htmlFor="security-question-current-password" className="mb-1 block text-sm font-medium text-gray-700">
                Current password
              </label>
              <input
                id="security-question-current-password"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving || questions.length === 0}
              className="rounded-xl bg-[#2d6a4f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b4d3e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save security question'}
            </button>
          </form>
        </>
      )}
    </section>
  );
};

export default SecurityQuestionSection;
