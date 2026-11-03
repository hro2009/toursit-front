import { byId, state } from './api.js';

const dictionaries = {
  en: () => import('../lang/en.json', { with: { type: 'json' } }).then(module => module.default),
  ru: () => import('../lang/ru.json', { with: { type: 'json' } }).then(module => module.default),
  hy: () => import('../lang/hy.json', { with: { type: 'json' } }).then(module => module.default)
};
let messages = {};

export async function setLanguage(language) {
  state.language = dictionaries[language] ? language : 'en';
  messages = await dictionaries[state.language]();
  document.documentElement.lang = state.language;
  localStorage.setItem('hayq-language', state.language);
  byId('language').value = state.language;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const value = messages[element.dataset.i18n];
    if (value) element.textContent = value;
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const value = messages[element.dataset.i18nAriaLabel];
    if (value) element.setAttribute('aria-label', value);
  });
  document.dispatchEvent(new CustomEvent('hayq:language'));
}

export const t = key => messages[key] || key;
export const currentMessages = () => messages;
