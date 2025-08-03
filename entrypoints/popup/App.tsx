import './App.css';
import { DebugPanel } from './DebugPanel';

function App() {
  console.log('App component rendered!');
  
  return (
    <>
      {/* Debug panel - easy to remove later */}
      <DebugPanel />
    </>
  );
}

export default App;
