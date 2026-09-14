'use client';

import { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { getSocket } from '@/lib/socket';

interface LiveEditorProps {
  roomCode: string;
  code: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function LiveEditor({
  roomCode,
  code,
  language,
  onChange,
  readOnly = false,
}: LiveEditorProps) {
  const editorRef = useRef<any>(null);
  const isSelfChange = useRef(false);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Listen for incoming code updates from opponent
    const socket = getSocket();
    socket.on('opponent_code_update', (data: { code: string; language: string }) => {
      if (editorRef.current && !isSelfChange.current) {
        const position = editorRef.current.getPosition();
        editorRef.current.setValue(data.code);
        if (position) editorRef.current.setPosition(position);
      }
    });

    return () => {
      socket.off('opponent_code_update');
    };
  };

  const handleCodeChange = (value: string | undefined) => {
    const val = value || '';
    onChange(val);

    if (!readOnly) {
      isSelfChange.current = true;
      const socket = getSocket();
      socket.emit('code_change', {
        roomCode,
        code: val,
        language,
      });

      setTimeout(() => {
        isSelfChange.current = false;
      }, 50);
    }
  };

  return (
    <div className="h-full w-full border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 flex flex-col">
      <Editor
        height="100%"
        language={language === 'python' ? 'python' : 'javascript'}
        value={code}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', 'Courier New', monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly,
          tabSize: 2,
          padding: { top: 12, bottom: 12 },
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
        onMount={handleEditorDidMount}
        onChange={handleCodeChange}
      />
    </div>
  );
}
