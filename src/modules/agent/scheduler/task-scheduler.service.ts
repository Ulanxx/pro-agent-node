import { Injectable, Logger } from '@nestjs/common';
import { Task, TaskStatus, TaskList } from '../../../core/dsl/task.types';

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  /**
   * 获取下一个可执行的任务
   */
  getNextTask(taskList: TaskList): Task | null {
    // 1. 找出所有状态为 READY 的任务
    const readyTasks = taskList.tasks.filter(
      (t) => t.status === TaskStatus.READY,
    );

    if (readyTasks.length === 0) {
      this.logger.debug('No ready tasks found');
      return null;
    }

    // 2. 按优先级排序（数字越大优先级越高）
    readyTasks.sort((a, b) => b.priority - a.priority);

    // 3. 返回优先级最高的任务
    const nextTask = readyTasks[0];
    this.logger.log(
      `Next task: ${nextTask.id} (${nextTask.type}) with priority ${nextTask.priority}`,
    );

    return nextTask;
  }

  /**
   * 更新任务状态并检查依赖
   */
  updateTaskStatus(
    taskList: TaskList,
    taskId: string,
    status: TaskStatus,
    result?: any,
    error?: string,
  ): Task[] {
    const task = taskList.tasks.find((t) => t.id === taskId);
    if (!task) {
      this.logger.warn(`Task ${taskId} not found`);
      return [];
    }

    const oldStatus = task.status;
    task.status = status;
    task.result = result;
    task.error = error;
    task.metadata.updatedAt = Date.now();

    this.logger.log(`Task ${taskId} status updated: ${oldStatus} -> ${status}`);

    // 更新任务列表状态
    taskList.updatedAt = Date.now();

    // 更新依赖此任务的其他任务状态
    const dependentTasks = taskList.tasks.filter((t) =>
      t.dependencies.some((d) => d.taskId === taskId),
    );

    const newlyReadyTasks: Task[] = [];

    for (const dependent of dependentTasks) {
      if (
        this.areDependenciesSatisfied(dependent, taskList.tasks) &&
        dependent.status === TaskStatus.PENDING
      ) {
        dependent.status = TaskStatus.READY;
        newlyReadyTasks.push(dependent);
        this.logger.log(`Task ${dependent.id} is now ready to execute`);
      }
    }

    return newlyReadyTasks;
  }

  /**
   * 检查任务依赖是否满足
   */
  private areDependenciesSatisfied(task: Task, allTasks: Task[]): boolean {
    for (const dep of task.dependencies) {
      const depTask = allTasks.find((t) => t.id === dep.taskId);
      if (!depTask) {
        this.logger.warn(`Dependency task ${dep.taskId} not found`);
        return false;
      }

      // 根据条件检查依赖
      switch (dep.condition) {
        case 'success':
          if (depTask.status !== TaskStatus.COMPLETED) {
            return false;
          }
          break;
        case 'any':
          if (
            ![
              TaskStatus.COMPLETED,
              TaskStatus.FAILED,
              TaskStatus.SKIPPED,
            ].includes(depTask.status)
          ) {
            return false;
          }
          break;
        case 'all':
        default:
          if (depTask.status !== TaskStatus.COMPLETED) {
            return false;
          }
          break;
      }
    }
    return true;
  }

  /**
   * 初始化任务列表的状态
   * 将没有依赖的任务设置为 READY
   */
  initializeTaskList(taskList: TaskList): void {
    for (const task of taskList.tasks) {
      if (task.dependencies.length === 0) {
        task.status = TaskStatus.READY;
        this.logger.log(`Task ${task.id} initialized as READY`);
      }
    }
    taskList.status = 'executing';
    taskList.updatedAt = Date.now();
  }

  /**
   * 检查是否所有任务都已完成
   */
  isAllTasksCompleted(taskList: TaskList): boolean {
    return taskList.tasks.every(
      (t) =>
        t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED,
    );
  }

  /**
   * 检查是否有任务失败
   */
  hasFailedTasks(taskList: TaskList): boolean {
    return taskList.tasks.some((t) => t.status === TaskStatus.FAILED);
  }

  /**
   * 获取任务统计信息
   */
  getTaskStatistics(taskList: TaskList) {
    const stats = {
      total: taskList.tasks.length,
      pending: 0,
      ready: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const task of taskList.tasks) {
      stats[task.status]++;
    }

    return stats;
  }

  /**
   * 重试失败的任务
   */
  retryFailedTask(taskList: TaskList, taskId: string): boolean {
    const task = taskList.tasks.find((t) => t.id === taskId);
    if (!task || task.status !== TaskStatus.FAILED) {
      return false;
    }

    // 检查是否可以重试
    if (
      task.metadata.canRetry === false ||
      (task.metadata.maxRetries !== undefined &&
        task.retryCount! >= task.metadata.maxRetries)
    ) {
      this.logger.warn(`Task ${taskId} cannot be retried`);
      return false;
    }

    task.status = TaskStatus.READY;
    task.error = undefined;
    task.retryCount = (task.retryCount || 0) + 1;
    task.metadata.updatedAt = Date.now();

    this.logger.log(`Task ${taskId} retry ${task.retryCount} initiated`);

    return true;
  }

  /**
   * 跳过任务
   */
  skipTask(taskList: TaskList, taskId: string): boolean {
    const task = taskList.tasks.find((t) => t.id === taskId);
    if (!task) {
      return false;
    }

    // 只能跳过 PENDING 或 READY 状态的任务
    if (
      task.status !== TaskStatus.PENDING &&
      task.status !== TaskStatus.READY
    ) {
      return false;
    }

    task.status = TaskStatus.SKIPPED;
    task.metadata.updatedAt = Date.now();

    this.logger.log(`Task ${taskId} skipped`);

    // 更新依赖此任务的其他任务状态
    const dependentTasks = taskList.tasks.filter((t) =>
      t.dependencies.some((d) => d.taskId === taskId),
    );

    const newlyReadyTasks: Task[] = [];

    for (const dependent of dependentTasks) {
      if (
        this.areDependenciesSatisfied(dependent, taskList.tasks) &&
        dependent.status === TaskStatus.PENDING
      ) {
        dependent.status = TaskStatus.READY;
        newlyReadyTasks.push(dependent);
        this.logger.log(`Task ${dependent.id} is now ready to execute`);
      }
    }

    return true;
  }
}
