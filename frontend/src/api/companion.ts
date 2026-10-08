import { api } from "./client";
import axios from "axios";
export interface Context {
  grade: number;
  subject: string;
  topic: string;
  language: "ru" | "en" | "de" | "uk";
  difficulty: "easy" | "medium" | "hard";
}
export const defaultContext: Context = {
  grade: 8,
  subject: "",
  topic: "",
  language: "ru",
  difficulty: "medium",
};
export interface Conversation {
  id: string;
  title: string;
  mode: string;
  context: Context;
  messages: {
    role: "user" | "assistant";
    content: string;
    hadImage?: boolean;
  }[];
}
export interface Deck {
  id: string;
  title: string;
  context: Context;
  cards: { question: string; answer: string }[];
  known: number[];
}
export interface Quiz {
  id: string;
  title: string;
  context: Context;
  questions: {
    question: string;
    type: string;
    options: string[];
    answer?: string;
    explanation?: string;
    topic: string;
  }[];
  answers: { answer: string; correct: boolean }[];
  completed: boolean;
  score?: number;
  percentage?: number;
  weakTopics?: string[];
}
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
}
export interface Task {
  id: string;
  title: string;
  subject: string;
  kind: "homework" | "test";
  dueAt: string;
  done: boolean;
}
export interface Lesson {
  id: string;
  subject: { name: string };
  teacherName?: string;
  room?: string;
  startTime: string;
  endTime: string;
  state?: string;
  minutesUntil?: number;
}
export interface Dashboard {
  date: string;
  timezone: string;
  hasGroup: boolean;
  schedule: Lesson[];
  nextLesson: Lesson | null;
  tasks: Task[];
  conversations: Conversation[];
  progress: {
    streak: number;
    topicsStudied: number;
    quizAccuracy: number | null;
    completedQuizzes: number;
    weakTopics: string[];
  };
  activity: { type: string; topic: string; subject: string; date: string }[];
}
export async function getCompanion<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return (await api.get(`/companion/${path}`, { signal })).data.data;
}
export async function postCompanion<T>(
  path: string,
  data: unknown,
): Promise<T> {
  return (await api.post(`/companion/${path}`, data, { timeout: 120000 })).data
    .data;
}
export function errorText(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.error === "string") return data.error;
    if (Array.isArray(data?.detail))
      return "Проверьте заполненные поля и размер файла.";
    if (error.code === "ECONNABORTED")
      return "Время ожидания истекло. Обновите список перед повторной попыткой.";
    if (!error.response)
      return "Не удалось связаться с сервером. Проверьте соединение.";
  }
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}
