import { ActionBar } from './ui/ActionBar';
import { BrushPanel } from './ui/BrushPanel';
import { CanvasStage } from './ui/CanvasStage';
import { ColorPanel } from './ui/ColorPanel';
import { GuideBar } from './ui/GuideBar';
import { Header } from './ui/Header';
import { LayersPanel } from './ui/LayersPanel';
import { StatusBar } from './ui/StatusBar';
import { Toolbar } from './ui/Toolbar';
import { ViewBar } from './ui/ViewBar';

export default function App() {
  return (
    <div id="app">
      <CanvasStage />
      <Header />
      <Toolbar />
      <GuideBar />
      <ViewBar />
      <ActionBar />
      <ColorPanel />
      <LayersPanel />
      <BrushPanel />
      <StatusBar />
    </div>
  );
}
