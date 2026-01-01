const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to server');
  
  // 1. Send a chat message
  const topic = 'Future of Robotics in 2025';
  console.log(`Sending message: ${topic}`);
  socket.emit('chat:send', { message: topic, sessionId: 'test-session-123' });
});

socket.on('progress', (data) => {
  console.log('Progress Update:', {
    status: data.status,
    progress: data.progress,
    message: data.message,
    artifactId: data.artifactId || 'none'
  });
});

socket.on('thought:update', (data) => {
  console.log('Thought Update:', {
    messageId: data.messageId,
    thoughtId: data.thought.id,
    status: data.thought.status,
    content: data.thought.content,
    artifactId: data.thought.artifactId || 'none'
  });
});

socket.on('artifact:update', (data) => {
  let countInfo = 'N/A';
  if (data.type === 'plan' && data.content && data.content.outline) {
    countInfo = `${data.content.outline.length} slides planned`;
  } else if (data.type === 'dsl' && data.content && data.content.pages) {
    countInfo = `${data.content.pages.length} pages generated`;
  }

  console.log('Artifact Update:', {
    id: data.id,
    type: data.type,
    version: data.version,
    info: countInfo
  });
});

socket.on('plan:update', (data) => {
  console.log('Plan Update:', {
    artifactId: data.artifactId,
    taskCount: data.tasks.length,
    tasks: data.tasks.map(t => `${t.content} (${t.status})`).join(', ')
  });
});

socket.on('tool:artifact', (data) => {
  console.log('Tool Artifact:', {
    messageId: data.messageId,
    type: data.artifact.type,
    artifactId: data.artifact.id,
    showInCanvas: data.showInCanvas
  });
});

socket.on('tool:log', (data) => {
  console.log('Tool Log:', {
    messageId: data.messageId,
    tool: data.log.tool,
    action: data.log.action,
    status: data.log.status,
    artifactId: data.log.artifactId || 'none'
  });
});

socket.on('completion', (data) => {
  console.log('Job Completed:', {
    success: data.success,
    finalArtifactId: data.finalArtifactId || 'none',
    result: data.result
  });
  process.exit(0);
});

socket.on('error', (err) => {
  console.error('Socket Error:', err);
  process.exit(1);
});

// Timeout after 60 seconds
setTimeout(() => {
  console.error('Test timed out');
  process.exit(1);
}, 60000);
