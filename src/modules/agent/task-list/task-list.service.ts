import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { TaskList, Task, TaskStatus } from '../../../core/dsl/task.types';

@Injectable()
export class TaskListService {
  private readonly logger = new Logger(TaskListService.name);
  private readonly redis: Redis;
  private readonly TASK_LIST_TTL = 86400; // 24 hours

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  /**
   * 保存任务列表
   */
  async saveTaskList(taskList: TaskList): Promise<void> {
    const key = `tasklist:${taskList.sessionId}`;
    await this.redis.set(key, JSON.stringify(taskList));
    await this.redis.expire(key, this.TASK_LIST_TTL);
    this.logger.log(`Task list saved for session ${taskList.sessionId}`);
  }

  /**
   * 获取任务列表
   */
  async getTaskList(sessionId: string): Promise<TaskList | null> {
    const key = `tasklist:${sessionId}`;
    const data = await this.redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as TaskList;
  }

  /**
   * 更新任务列表
   */
  async updateTaskList(taskList: TaskList): Promise<void> {
    await this.saveTaskList(taskList);
  }

  /**
   * 删除任务列表
   */
  async deleteTaskList(sessionId: string): Promise<void> {
    const key = `tasklist:${sessionId}`;
    await this.redis.del(key);
    this.logger.log(`Task list deleted for session ${sessionId}`);
  }

  /**
   * 获取任务
   */
  async getTask(sessionId: string, taskId: string): Promise<Task | null> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      return null;
    }
    return taskList.tasks.find((t) => t.id === taskId) || null;
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    sessionId: string,
    taskId: string,
    status: TaskStatus,
    result?: any,
    error?: string,
  ): Promise<void> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      throw new Error(`Task list not found for session ${sessionId}`);
    }

    const task = taskList.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.status = status;
    task.result = result;
    task.error = error;
    task.metadata.updatedAt = Date.now();
    taskList.updatedAt = Date.now();

    await this.saveTaskList(taskList);
    this.logger.log(
      `Task ${taskId} status updated to ${status} for session ${sessionId}`,
    );
  }

  /**
   * 添加任务
   */
  async addTask(sessionId: string, task: Task): Promise<void> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      throw new Error(`Task list not found for session ${sessionId}`);
    }

    taskList.tasks.push(task);
    taskList.updatedAt = Date.now();

    await this.saveTaskList(taskList);
    this.logger.log(`Task ${task.id} added to session ${sessionId}`);
  }

  /**
   * 添加多个任务
   */
  async addTasks(sessionId: string, tasks: Task[]): Promise<void> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      throw new Error(`Task list not found for session ${sessionId}`);
    }

    taskList.tasks.push(...tasks);
    taskList.updatedAt = Date.now();

    await this.saveTaskList(taskList);
    this.logger.log(`${tasks.length} tasks added to session ${sessionId}`);
  }

  /**
   * 获取待执行的任务
   */
  async getPendingTasks(sessionId: string): Promise<Task[]> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      return [];
    }
    return taskList.tasks.filter(
      (t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.READY,
    );
  }

  /**
   * 获取正在执行的任务
   */
  async getInProgressTasks(sessionId: string): Promise<Task[]> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      return [];
    }
    return taskList.tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS);
  }

  /**
   * 获取已完成的任务
   */
  async getCompletedTasks(sessionId: string): Promise<Task[]> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      return [];
    }
    return taskList.tasks.filter((t) => t.status === TaskStatus.COMPLETED);
  }

  /**
   * 获取失败的任务
   */
  async getFailedTasks(sessionId: string): Promise<Task[]> {
    const taskList = await this.getTaskList(sessionId);
    if (!taskList) {
      return [];
    }
    return taskList.tasks.filter((t) => t.status === TaskStatus.FAILED);
  }

  /**
   * 清理旧的任务列表
   */
  async cleanupOldTaskLists(maxAge: number = 86400): Promise<number> {
    const pattern = 'tasklist:*';
    const keys = await this.redis.keys(pattern);
    let deletedCount = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        // 没有过期时间，检查创建时间
        const data = await this.redis.get(key);
        if (data) {
          const taskList = JSON.parse(data) as TaskList;
          const age = Date.now() - taskList.createdAt;
          if (age > maxAge * 1000) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }
    }

    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} old task lists`);
    }

    return deletedCount;
  }
}
