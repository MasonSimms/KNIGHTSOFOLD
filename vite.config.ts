import { defineConfig } from 'vite';

// The dev server listens on $PORT when one is given (the desktop app's preview picks a free port, so two chats can each run the game), otherwise on 5173.
export default defineConfig({ server: { port: Number(process.env.PORT) || 5173, strictPort: !!process.env.PORT } });
