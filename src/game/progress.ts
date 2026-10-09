const KEY = "ionreach-story-v3";

interface Story {
  watched: string[];
  cleared: string[];
}

function read(): Story {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { watched: [], cleared: [] };
    const parsed = JSON.parse(raw) as Story;
    return { watched: parsed.watched ?? [], cleared: parsed.cleared ?? [] };
  } catch {
    return { watched: [], cleared: [] };
  }
}

function write(story: Story): void {
  localStorage.setItem(KEY, JSON.stringify(story));
}

export function markWatched(id: string): void {
  const story = read();
  if (story.watched.includes(id)) return;
  story.watched.push(id);
  write(story);
}

export function markCleared(id: string): void {
  const story = read();
  if (story.cleared.includes(id)) return;
  story.cleared.push(id);
  write(story);
}

export function storyOpen(prevId: string | null): boolean {
  if (!prevId) return true;
  const story = read();
  return story.watched.includes(prevId) || story.cleared.includes(prevId);
}
