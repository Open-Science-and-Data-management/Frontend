import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { taskApi } from '@/api/taskApi';
import { useTaskStore } from '@/store/taskStore';

export const useTask = (taskId?: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getTaskById } = useTaskStore();
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const fetchTask = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // First check if the task exists in the store
        const storeTask = getTaskById(taskId);
        
        if (storeTask) {
          setTask(storeTask);
        } else {
          // If not in store, fetch from API
          const fetchedTask = await taskApi.getTask(taskId);
          if (fetchedTask) {
            setTask(fetchedTask);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTask();
  }, [taskId, getTaskById]);

  return { task, isLoading, error };
};
