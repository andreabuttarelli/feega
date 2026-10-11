const APP_ENTRY_TEXT = /^\s*(log ?in|sign ?in|sign ?up|accedi|entra|registrati|anmelden|connexion|se connecter|iniciar sesión|get started|start for free|try (it )?(for )?free|let[’']s start|start free trial)\s*$/i;

export const leadsIntoApp = (text: string) => APP_ENTRY_TEXT.test(text);
