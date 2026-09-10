"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, TranslationQuizQuestion } from "@/lib/api";

type QuizScope = "pending" | "active";

interface TranslationQuizReviewProps {
  onSwitchToFlashcards: () => void;
  onSavingChange: (saving: boolean) => void;
}

function getOptionClass(
  option: string,
  selectedOption: string | null,
  correctTranslation: string,
) {
  const base =
    "w-full rounded-xl border px-4 py-4 text-left text-sm font-bold transition-premium";

  if (!selectedOption) {
    return `${base} border-border-custom bg-bg-dark text-text-white hover:border-brand-blue/50 hover:bg-bg-medium/50`;
  }

  if (option === correctTranslation) {
    return `${base} border-emerald-500/60 bg-emerald-500/15 text-success`;
  }

  if (option === selectedOption) {
    return `${base} border-brand-red/70 bg-brand-red/15 text-danger`;
  }

  return `${base} border-border-custom bg-bg-black text-text-muted opacity-55`;
}

export default function TranslationQuizReview({
  onSwitchToFlashcards,
  onSavingChange,
}: TranslationQuizReviewProps) {
  const saving = useRef(false);
  const requestId = useRef(0);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [scope, setScope] = useState<QuizScope>("pending");
  const [questions, setQuestions] = useState<TranslationQuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<
    TranslationQuizQuestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  const fetchQuiz = async (nextScope: QuizScope) => {
    const id = ++requestId.current;
    setScope(nextScope);
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswerSaved(false);
    setCorrectCount(0);
    setWrongQuestions([]);
    setIsFinished(false);

    try {
      const data = await api.getTranslationQuiz(nextScope);
      if (id === requestId.current) setQuestions(data);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possivel carregar o quiz de traduções.";
      if (id === requestId.current) setError(message);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  };

  const cancelRequests = useCallback(() => {
    requestId.current++;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchQuiz("pending");
    }, 0);
    return () => {
      clearTimeout(timer);
      cancelRequests();
    };
  }, [cancelRequests]);

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = answerSaved ? currentIndex + 1 : currentIndex;
  const progressPercent =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const wrongCount = wrongQuestions.length;

  const saveAnswer = async (option: string) => {
    if (!currentQuestion || saving.current || answerSaved) return;
    saving.current = true;
    setIsSavingAnswer(true);
    onSavingChange(true);
    setError(null);
    const isCorrect = option === currentQuestion.correct_translation;
    try {
      await api.reviewTerm(
        currentQuestion.term_id,
        isCorrect ? "easy" : "again",
      );
      setAnswerSaved(true);
      if (isCorrect) setCorrectCount((count) => count + 1);
      else setWrongQuestions((questions) => [...questions, currentQuestion]);
    } catch {
      setError(
        "Não foi possível salvar sua resposta. Tente novamente antes de continuar.",
      );
    } finally {
      saving.current = false;
      setIsSavingAnswer(false);
      onSavingChange(false);
    }
  };

  const handleSelectOption = (option: string) => {
    if (selectedOption || saving.current) return;
    setSelectedOption(option);
    void saveAnswer(option);
  };

  const handleNext = () => {
    if (!selectedOption || isSavingAnswer || !answerSaved) return;

    if (currentIndex + 1 >= questions.length) {
      setIsFinished(true);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setAnswerSaved(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
        <p className="text-xs text-text-muted animate-pulse">
          Montando quiz de traduções...
        </p>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="p-8 border border-border-custom bg-bg-dark rounded-2xl text-center w-full shadow-2xl">
        <div className="w-14 h-14 rounded-xl bg-bg-medium flex items-center justify-center mb-6 text-text-muted mx-auto">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-base font-bold mb-3 text-text-white">
          Quiz indisponível
        </h3>
        <p className="text-text-muted text-xs mb-6 leading-relaxed">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => fetchQuiz("active")}
            className="rounded-lg bg-brand-blue hover:opacity-90 px-5 py-2.5 text-xs font-bold text-white transition-premium"
          >
            Tentar com termos em estudo
          </button>
          <button
            onClick={onSwitchToFlashcards}
            className="rounded-lg border border-border-custom bg-bg-black hover:bg-bg-medium px-5 py-2.5 text-xs font-bold text-text-muted hover:text-text-white transition-premium"
          >
            Ir para flashcards
          </button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="p-8 border border-border-custom bg-bg-dark rounded-2xl text-center w-full shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="w-14 h-14 rounded-full bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center mb-6 mx-auto text-accent">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold mb-2 text-text-white">
            Quiz finalizado
          </h2>
          <p className="text-text-muted text-xs mb-6 leading-relaxed">
            Você acertou {correctCount} de {totalQuestions}. Erros: {wrongCount}
            .
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-2xl font-extrabold text-success">
                {correctCount}
              </p>
              <p className="text-xs uppercase tracking-wider text-text-muted font-bold">
                Acertos
              </p>
            </div>
            <div className="rounded-xl border border-brand-red/20 bg-brand-red/10 p-4">
              <p className="text-2xl font-extrabold text-danger">
                {wrongCount}
              </p>
              <p className="text-xs uppercase tracking-wider text-text-muted font-bold">
                Erros
              </p>
            </div>
          </div>

          {wrongQuestions.length > 0 && (
            <div className="text-left mb-6 rounded-xl border border-border-custom bg-bg-black p-4">
              <p className="text-xs uppercase tracking-wider text-text-muted font-bold mb-3">
                Termos que continuam nos flashcards
              </p>
              <ul className="space-y-2">
                {wrongQuestions.map((question) => (
                  <li
                    key={question.term_id}
                    className="flex items-center justify-between gap-3 text-xs border-b border-border-custom last:border-b-0 pb-2 last:pb-0"
                  >
                    <span className="font-bold text-text-white ">
                      {question.text}
                    </span>
                    <span className="text-text-muted text-right">
                      {question.correct_translation}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => fetchQuiz("pending")}
              className="rounded-lg bg-brand-blue hover:opacity-90 px-6 py-3 text-xs font-bold text-white transition-premium"
            >
              Novo quiz pendente
            </button>
            <button
              onClick={onSwitchToFlashcards}
              className="rounded-lg border border-border-custom bg-bg-black hover:bg-bg-medium px-6 py-3 text-xs font-bold text-text-muted hover:text-text-white transition-premium"
            >
              Revisar flashcards
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="p-8 border border-border-custom bg-bg-dark rounded-2xl text-center w-full shadow-2xl">
        <h3 className="text-base font-bold mb-3 text-text-white">
          Nenhuma pergunta disponível
        </h3>
        <p className="text-text-muted text-xs mb-6 leading-relaxed">
          Não há termos pendentes com tradução suficiente para montar este quiz.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {scope === "pending" && (
            <button
              onClick={() => fetchQuiz("active")}
              className="rounded-lg bg-brand-blue hover:opacity-90 px-5 py-2.5 text-xs font-bold text-white transition-premium"
            >
              Revisar todos em estudo
            </button>
          )}
          <button
            onClick={onSwitchToFlashcards}
            className="rounded-lg border border-border-custom bg-bg-black hover:bg-bg-medium px-5 py-2.5 text-xs font-bold text-text-muted hover:text-text-white transition-premium"
          >
            Ir para flashcards
          </button>
        </div>
      </div>
    );
  }

  const selectedIsCorrect =
    selectedOption === currentQuestion.correct_translation;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full mb-4 flex justify-between items-center text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs">
            Pergunta {currentIndex + 1} de {totalQuestions}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-blue/10 text-accent border border-brand-blue/20 font-bold uppercase tracking-wider">
            {scope === "pending" ? "Pendentes" : "Em estudo"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-success font-bold">
            {correctCount} acertos
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-brand-red/10 border border-brand-red/20 text-danger font-bold">
            {wrongCount} erros
          </span>
        </div>
      </div>

      <div className="w-full h-1 bg-bg-medium rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-brand-blue rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="w-full rounded-2xl border border-border-custom bg-bg-dark p-6 shadow-2xl mb-6">
        <div className="text-center mb-8">
          <span className="inline-flex text-xs font-bold uppercase tracking-widest text-accent bg-brand-blue/5 px-2.5 py-0.5 rounded border border-brand-blue/10 mb-5">
            Escolha a tradução correta
          </span>
          <p className="text-3xl font-extrabold text-text-white leading-relaxed tracking-tight break-words ">
            {currentQuestion.text}
          </p>
          <p className="text-xs uppercase tracking-wider text-text-muted font-bold mt-2">
            {currentQuestion.type === "word" ? "Palavra" : "Expressão"}
          </p>
        </div>

        <div className="grid gap-3" aria-busy={isSavingAnswer}>
          {currentQuestion.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={Boolean(selectedOption)}
              onClick={() => handleSelectOption(option)}
              className={getOptionClass(
                option,
                selectedOption,
                currentQuestion.correct_translation,
              )}
            >
              {option}
            </button>
          ))}
        </div>

        {selectedOption && (
          <div
            role="status"
            className={`mt-5 rounded-xl border p-4 text-xs font-semibold ${
              selectedIsCorrect
                ? "border-emerald-500/30 bg-emerald-500/10 text-success"
                : "border-brand-red/30 bg-brand-red/10 text-danger"
            }`}
          >
            {selectedIsCorrect
              ? answerSaved
                ? "Correto. Próxima revisão em 1 dia."
                : "Resposta correta. Aguardando salvamento."
              : `Errado. A resposta certa é "${currentQuestion.correct_translation}" e o termo continua nos flashcards.`}
          </div>
        )}

        {error && questions.length > 0 && (
          <div role="alert" className="mt-4 text-sm text-danger">
            <p>{error}</p>
            <button
              type="button"
              disabled={isSavingAnswer}
              onClick={() => selectedOption && void saveAnswer(selectedOption)}
              className="mt-2 py-2 underline font-bold"
            >
              Tentar salvar novamente
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!selectedOption || isSavingAnswer || !answerSaved}
        onClick={handleNext}
        className="w-full bg-brand-blue hover:opacity-90 text-white font-bold py-4 rounded-lg shadow-lg shadow-brand-blue/10 transition-premium active:scale-[0.98] text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSavingAnswer
          ? "Salvando..."
          : currentIndex + 1 >= questions.length
            ? "Ver resultado"
            : "Próxima palavra"}
      </button>
    </div>
  );
}
