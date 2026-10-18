// Plain module (not "use client") so the server layout can inline the string.
export const THEME_KEY = "lifeos-theme";
/** Runs before paint (inlined in <head>) so the page never flashes the wrong theme. Default: light. */
export const THEME_BOOT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'light';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('light',!d);}catch(e){document.documentElement.classList.add('light');}})();`;

