import { BrushPanel } from './ui/BrushPanel';
import { CanvasStage } from './ui/CanvasStage';
import { Header } from './ui/Header';
import { StatusBar } from './ui/StatusBar';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  return (
    <div id="app">
      <Header />
      <div id="work">
        <Toolbar />
        <CanvasStage />
        <BrushPanel />
      </div>
      <StatusBar />
    </div>
  );
}
