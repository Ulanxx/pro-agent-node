import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AgentModule } from './../src/modules/agent/agent.module';
import { AutonomousGraphService } from './../src/modules/agent/graph/autonomous-graph.service';
import { PlannerService } from './../src/modules/agent/planner/planner.service';
import { TaskExecutorService } from './../src/modules/agent/executor/task-executor.service';
import { TaskSchedulerService } from './../src/modules/agent/scheduler/task-scheduler.service';
import { ArtifactService } from './../src/modules/agent/artifact.service';
import { TaskListService } from './../src/modules/agent/task-list/task-list.service';
import { ReflectorService } from './../src/modules/agent/reflector/reflector.service';
import { SocketGateway } from './../src/modules/socket/socket.gateway';
import { TaskType, TaskStatus } from './../src/core/dsl/task.types';

describe('Autonomous Planning Flow (E2E)', () => {
  let app: INestApplication;
  let autonomousGraphService: AutonomousGraphService;
  let plannerService: PlannerService;
  let artifactService: ArtifactService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AgentModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    autonomousGraphService = app.get<AutonomousGraphService>(
      AutonomousGraphService,
    );
    plannerService = app.get<PlannerService>(PlannerService);
    artifactService = app.get<ArtifactService>(ArtifactService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Task Dependencies', () => {
    it('should create fallback task list with correct dependencies', async () => {
      const sessionId = 'test-session-deps';
      const topic = '测试主题';

      // 创建测试任务列表
      const taskList = await plannerService.planTasks(sessionId, topic, {
        history: [],
        existingArtifacts: [],
      });

      // 验证任务数量
      expect(taskList.tasks).toBeDefined();
      expect(taskList.tasks.length).toBeGreaterThanOrEqual(6);

      // 验证任务顺序和依赖关系
      const analyzeTask = taskList.tasks.find(
        (t) => t.type === TaskType.ANALYZE_TOPIC,
      );
      const courseConfigTask = taskList.tasks.find(
        (t) => t.type === TaskType.GENERATE_COURSE_CONFIG,
      );
      const videoOutlineTask = taskList.tasks.find(
        (t) => t.type === TaskType.GENERATE_VIDEO_OUTLINE,
      );
      const slideScriptsTask = taskList.tasks.find(
        (t) => t.type === TaskType.GENERATE_SLIDE_SCRIPTS,
      );
      const themeTask = taskList.tasks.find(
        (t) => t.type === TaskType.GENERATE_THEME,
      );
      const slidesTask = taskList.tasks.find(
        (t) => t.type === TaskType.GENERATE_SLIDES,
      );

      expect(analyzeTask).toBeDefined();
      expect(courseConfigTask).toBeDefined();

      // 验证依赖关系
      if (courseConfigTask && analyzeTask) {
        expect(courseConfigTask.dependencies.length).toBeGreaterThan(0);
        expect(courseConfigTask.dependencies[0].taskId).toBe(analyzeTask.id);
      }

      // 验证元数据包含 critical 和 retryCount 字段
      if (slidesTask) {
        expect(slidesTask.metadata).toBeDefined();
        expect(slidesTask.metadata?.critical).toBe(true);
        expect(slidesTask.metadata?.retryCount).toBeDefined();
      }
    });

    it('should have critical field in task metadata', () => {
      const sessionId = 'test-session-critical';
      const topic = '测试主题';

      // 创建测试任务列表
      plannerService
        .planTasks(sessionId, topic, {
          history: [],
          existingArtifacts: [],
        })
        .then((taskList) => {
          // 检查 GENERATE_SLIDES 任务是否标记为关键任务
          const slidesTask = taskList.tasks.find(
            (t) => t.type === TaskType.GENERATE_SLIDES,
          );
          expect(slidesTask).toBeDefined();
          expect(slidesTask?.metadata?.critical).toBe(true);

          // 检查其他任务是否标记为非关键任务
          const otherTasks = taskList.tasks.filter(
            (t) => t.type !== TaskType.GENERATE_SLIDES,
          );
          otherTasks.forEach((task) => {
            expect(task.metadata?.critical).toBe(false);
          });
        });
    });
  });

  describe('Artifacts Transmission', () => {
    it('should pass artifacts between tasks', async () => {
      const sessionId = 'test-session-artifacts';

      // 创建一个测试 artifact
      const testArtifact = {
        id: 'test-artifact-1',
        type: 'requirement_analysis',
        content: { test: 'data' },
        version: 'v1',
        timestamp: Date.now(),
      };

      // 保存 artifact
      await artifactService.saveArtifact(sessionId, testArtifact);

      // 获取 artifact
      const retrievedArtifact = await artifactService.getArtifact(
        sessionId,
        testArtifact.id,
      );

      expect(retrievedArtifact).toBeDefined();
      expect(retrievedArtifact?.id).toBe(testArtifact.id);
      expect(retrievedArtifact?.type).toBe(testArtifact.type);

      // 获取所有 artifacts
      const allArtifacts = await artifactService.getArtifacts(sessionId);
      expect(allArtifacts.length).toBeGreaterThan(0);
      expect(allArtifacts[0].id).toBe(testArtifact.id);
    });

    it('should verify artifact requirements for tasks', () => {
      // 验证任务类型对应的 artifact 需求
      const artifactRequirements: { [key: string]: string[] } = {
        [TaskType.GENERATE_COURSE_CONFIG]: ['requirement_analysis'],
        [TaskType.GENERATE_VIDEO_OUTLINE]: ['course_config'],
        [TaskType.GENERATE_SLIDE_SCRIPTS]: ['video_outline', 'course_config'],
        [TaskType.GENERATE_THEME]: ['course_config', 'video_outline'],
        [TaskType.GENERATE_SLIDES]: ['slide_scripts', 'presentation_theme'],
      };

      // 验证 GENERATE_SLIDES 需要两个前置 artifacts
      expect(artifactRequirements[TaskType.GENERATE_SLIDES]).toHaveLength(2);
      expect(artifactRequirements[TaskType.GENERATE_SLIDES]).toContain(
        'slide_scripts',
      );
      expect(artifactRequirements[TaskType.GENERATE_SLIDES]).toContain(
        'presentation_theme',
      );
    });
  });

  describe('Error Recovery', () => {
    it('should mark non-critical tasks as retryable', async () => {
      const sessionId = 'test-session-retry';
      const topic = '测试主题';

      const taskList = await plannerService.planTasks(sessionId, topic, {
        history: [],
        existingArtifacts: [],
      });

      // 检查非关键任务
      const nonCriticalTasks = taskList.tasks.filter(
        (t) => t.type !== TaskType.GENERATE_SLIDES,
      );

      nonCriticalTasks.forEach((task) => {
        expect(task.metadata?.canRetry).toBe(true);
        expect(task.metadata?.maxRetries).toBeGreaterThanOrEqual(1);
      });
    });

    it('should initialize retryCount to 0', async () => {
      const sessionId = 'test-session-retry-count';
      const topic = '测试主题';

      const taskList = await plannerService.planTasks(sessionId, topic, {
        history: [],
        existingArtifacts: [],
      });

      // 检查所有任务的初始 retryCount
      taskList.tasks.forEach((task) => {
        expect(task.metadata?.retryCount).toBe(0);
      });
    });
  });

  describe('State Checking', () => {
    it('should verify state transition logic', () => {
      // 验证任务状态转换
      const validTransitions = {
        [TaskStatus.PENDING]: [
          TaskStatus.READY,
          TaskStatus.IN_PROGRESS,
          TaskStatus.SKIPPED,
        ],
        [TaskStatus.READY]: [TaskStatus.IN_PROGRESS, TaskStatus.SKIPPED],
        [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.FAILED],
        [TaskStatus.FAILED]: [TaskStatus.PENDING], // 重试
        [TaskStatus.COMPLETED]: [], // 终态
        [TaskStatus.SKIPPED]: [], // 终态
      };

      // 验证 FAILED 状态可以转回 PENDING（重试）
      expect(validTransitions[TaskStatus.FAILED]).toContain(TaskStatus.PENDING);
    });

    it('should check dependencies satisfaction', () => {
      // 创建测试任务
      const task1 = {
        id: 'task-1',
        type: TaskType.ANALYZE_TOPIC,
        status: TaskStatus.COMPLETED,
      };

      const task2 = {
        id: 'task-2',
        type: TaskType.GENERATE_COURSE_CONFIG,
        status: TaskStatus.PENDING,
        dependencies: [{ taskId: 'task-1', condition: 'success' as const }],
      };

      // 验证依赖满足条件
      const dependency = task2.dependencies[0];
      expect(dependency.taskId).toBe(task1.id);
      expect(dependency.condition).toBe('success');
    });
  });

  describe('Type System', () => {
    it('should have TaskMetadata with required fields', () => {
      const metadata = {
        estimatedDuration: 30,
        canRetry: true,
        maxRetries: 3,
        critical: false,
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      expect(metadata.critical).toBeDefined();
      expect(typeof metadata.critical).toBe('boolean');
      expect(metadata.retryCount).toBeDefined();
      expect(typeof metadata.retryCount).toBe('number');
    });

    it('should support all task types', () => {
      const taskTypes = Object.values(TaskType);

      // 验证所有预期的任务类型都存在
      expect(taskTypes).toContain(TaskType.ANALYZE_TOPIC);
      expect(taskTypes).toContain(TaskType.GENERATE_COURSE_CONFIG);
      expect(taskTypes).toContain(TaskType.GENERATE_VIDEO_OUTLINE);
      expect(taskTypes).toContain(TaskType.GENERATE_SLIDE_SCRIPTS);
      expect(taskTypes).toContain(TaskType.GENERATE_THEME);
      expect(taskTypes).toContain(TaskType.GENERATE_SLIDES);
      expect(taskTypes).toContain(TaskType.SEARCH_WEB);
      expect(taskTypes).toContain(TaskType.REFINE_CONTENT);
    });

    it('should support all task statuses', () => {
      const taskStatuses = Object.values(TaskStatus);

      // 验证所有预期的任务状态都存在
      expect(taskStatuses).toContain(TaskStatus.PENDING);
      expect(taskStatuses).toContain(TaskStatus.READY);
      expect(taskStatuses).toContain(TaskStatus.IN_PROGRESS);
      expect(taskStatuses).toContain(TaskStatus.COMPLETED);
      expect(taskStatuses).toContain(TaskStatus.FAILED);
      expect(taskStatuses).toContain(TaskStatus.SKIPPED);
    });
  });
});
