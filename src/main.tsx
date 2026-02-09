import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppErrorBoundary } from './AppErrorBoundary.tsx'
import { installGlobalErrorHandlers } from './globalErrorHandler.ts'
import './index.css'

installGlobalErrorHandlers()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<AppErrorBoundary>
		<App />
	</AppErrorBoundary>
)
