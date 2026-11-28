import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GrcLankerDockLoader } from './GrcLankerDockLoader';

interface MountOptions {
  frameworkId?: string;
  controlSlug?: string;
  controlTitle?: string;
  assessmentQuestions?: string[];
}

let root: Root | null = null;

function getOrCreateContainer() {
  let container = document.getElementById('myctrl-grclanker-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'myctrl-grclanker-root';
    document.body.appendChild(container);
  }
  return container;
}

export function mountGrcLankerDock({
  frameworkId,
  controlSlug,
  controlTitle,
  assessmentQuestions,
}: MountOptions = {}) {
  const container = getOrCreateContainer();
  if (!root) {
    root = createRoot(container);
  }
  root.render(
    <GrcLankerDockLoader
      frameworkId={frameworkId}
      controlSlug={controlSlug}
      controlTitle={controlTitle}
      assessmentQuestions={assessmentQuestions}
    />,
  );
}
