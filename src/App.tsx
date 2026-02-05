import { WhiteboardCanvas } from "./components/WhiteboardCanvas";
import "./App.css";

function App(): JSX.Element {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Whiteboard</h1>
        <p>Infinite whiteboard — text, images, videos, links, post-it notes, arrows.</p>
      </header>
      <WhiteboardCanvas />
    </div>
  );
}

export default App;
