import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter/index.css'
import './styles/global.css'

console.log(
  `%c Designed by:\n` +
  `%c` +
  ` ██╗  ██╗ █████╗ ██╗      █████╗ ███╗   ███╗ █████╗ ██████╗ ██╗ ██████╗ ██████╗ \n` +
  ` ██║ ██╔╝██╔══██╗██║     ██╔══██╗████╗ ████║██╔══██╗██╔══██╗██║██╔════╝██╔═══██╗\n` +
  ` █████╔╝ ███████║██║     ███████║██╔████╔██║███████║██████╔╝██║██║     ██║   ██║\n` +
  ` ██╔═██╗ ██╔══██║██║     ██╔══██║██║╚██╔╝██║██╔══██║██╔══██╗██║██║     ██║   ██║\n` +
  ` ██║  ██╗██║  ██║███████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║  ██║██║╚██████╗╚██████╔╝\n` +
  ` ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═════╝ \n\n` +
  ` 🔗 @calamarico\n`,
  'color: #aaa; font-size: 14px; font-weight: normal;',
  'color: #e0a0ff; font-size: 10px; font-family: monospace; font-weight: bold;'
)
console.log("%c💻 Kalamarico", "font-size:20px; color:#a3e635;");
console.log("Senior Frontend Engineer @ Kalamarico\n\n");

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
