import { BrushPanel } from './ui/BrushPanel';
import { CanvasStage } from './ui/CanvasStage';
import { GuideBar } from './ui/GuideBar';
import { Header } from './ui/Header';
import { StatusBar } from './ui/StatusBar';
import { Toolbar } from './ui/Toolbar';

export default function App() {
  return (
    <div id="app">
      <CanvasStage />
      <Header />
      <Toolbar />
      <GuideBar />
      <BrushPanel />
      <StatusBar />
    </div>
  );
}
