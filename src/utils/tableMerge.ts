// src/utils/tableMerge.ts
export interface MergeConfig {
    props?: string[];  // 需要合并的列
    direction?: 'row' | 'column' | 'both';  // 合并方向
    auto?: boolean;    // 是否自动合并所有相同数据
  }
  
  /**
   * 创建单元格合并方法
   * @param mergeConfig 合并配置
   * @returns spanMethod函数
   */
  export function createSpanMethod(mergeConfig: MergeConfig = {}) {
    const { props = [], direction = 'row', auto = false } = mergeConfig;
    
    // 上次处理的数据标识，用于检测数据变化
    let lastDataLength = 0;
    let lastStartIndex = -1;
    
    // 合并结果缓存
    const mergeCache = new Map();
    
    return function(data: any) {
      const { row, column, rowIndex, columnIndex, _virtualScroll } = data;
      
      // 获取虚拟滚动信息
      const virtualScroll = _virtualScroll || {
        startIndex: 0,
        endIndex: 0,
        visibleData: [],
        allData: [] // 如果没有虚拟滚动信息，则假设没有使用虚拟滚动
      };
      
      // 完整数据集
      const allData = virtualScroll.allData || [];
      const visibleData = virtualScroll.visibleData || [];
      
      // 检测数据变化，如果数据变化了，清除缓存
      if (lastDataLength !== allData.length || lastStartIndex !== virtualScroll.startIndex) {
        mergeCache.clear();
        lastDataLength = allData.length;
        lastStartIndex = virtualScroll.startIndex;
      }
      
      // 全局行索引（考虑虚拟滚动）
      const globalRowIndex = virtualScroll.startIndex + rowIndex;
      
      // 不处理序号列和选择列
      if (column.type === 'index' || column.type === 'selection') {
        return {
          rowspan: 1,
          colspan: 1
        };
      }
      
      // 获取当前列的prop
      const prop = column.property;
      
      // 安全检查：确保行数据存在
      if (!row) {
        console.warn('Row data is undefined in spanMethod', { rowIndex, columnIndex, prop });
        return {
          rowspan: 1,
          colspan: 1
        };
      }
      
      // 如果设置了特定的合并列且当前列不在其中，则不合并
      if (props.length > 0 && !props.includes(prop) && !auto) {
        return {
          rowspan: 1,
          colspan: 1
        };
      }
      
      // 生成缓存键
      const cacheKey = `${globalRowIndex}_${prop}`;
      
      // 检查缓存
      if (mergeCache.has(cacheKey)) {
        return mergeCache.get(cacheKey);
      }
      
      // 行合并处理
      if (direction === 'row' || direction === 'both') {
        // 获取当前单元格的值
        const currentValue = row[prop];
        
        // 在虚拟滚动环境下，我们需要特殊处理
        // 1. 检查当前行是否是一个合并组的开始
        let isMergeStart = true;
        
        // 检查上一行是否与当前行相同
        if (globalRowIndex > 0 && allData[globalRowIndex - 1]) {
          if (allData[globalRowIndex - 1][prop] === currentValue) {
            isMergeStart = false;
            
            // 如果当前行不是合并组的开始，则隐藏它
            const result = { rowspan: 0, colspan: 0 };
            mergeCache.set(cacheKey, result);
            return result;
          }
        }
        
        // 如果当前行是合并组的开始，计算合并的行数
        if (isMergeStart) {
          // 向下查找相同值的行数
          let count = 0;
          for (let i = globalRowIndex + 1; i < allData.length; i++) {
            if (allData[i] && allData[i][prop] === currentValue) {
              count++;
            } else {
              break;
            }
          }
          
          if (count > 0) {
            // 计算可见范围内的合并行数
            const rowspan = Math.min(count + 1, virtualScroll.endIndex - globalRowIndex);
            
            const result = { rowspan: rowspan, colspan: 1 };
            mergeCache.set(cacheKey, result);
            return result;
          }
        }
      }
      
      // 列合并处理
      if (direction === 'column' || direction === 'both') {
        // 获取所有列
        const columns = data.table.store.states.columns.value;
        
        // 获取当前列的索引
        const currentColIndex = columns.findIndex((col: any) => col.property === prop);
        if (currentColIndex === -1) {
          const result = { rowspan: 1, colspan: 1 };
          mergeCache.set(cacheKey, result);
          return result;
        }
        
        // 获取当前单元格的值
        const currentValue = row[prop];
        
        // 检查左侧列是否与当前列相同
        let isMergeStart = true;
        
        for (let i = currentColIndex - 1; i >= 0; i--) {
          const col = columns[i];
          // 跳过序号列和选择列
          if (col.type === 'index' || col.type === 'selection') continue;
          
          // 跳过没有property的列
          if (!col.property) continue;
          
          // 如果设置了特定的合并列且当前列不在其中，则不合并
          if (props.length > 0 && !props.includes(col.property) && !auto) continue;
          
          if (row[col.property] === currentValue) {
            isMergeStart = false;
            
            // 如果当前列不是合并组的开始，则隐藏它
            const result = { rowspan: 1, colspan: 0 };
            mergeCache.set(cacheKey, result);
            return result;
          }
        }
        
        // 如果当前列是合并组的开始，计算合并的列数
        if (isMergeStart) {
          // 向右查找相同值的列数
          let count = 0;
          for (let i = currentColIndex + 1; i < columns.length; i++) {
            const col = columns[i];
            // 跳过没有property的列
            if (!col.property) continue;
            
            // 如果设置了特定的合并列且当前列不在其中，则不合并
            if (props.length > 0 && !props.includes(col.property) && !auto) continue;
            
            if (row[col.property] === currentValue) {
              count++;
            } else {
              break;
            }
          }
          
          if (count > 0) {
            const result = { rowspan: 1, colspan: count + 1 };
            mergeCache.set(cacheKey, result);
            return result;
          }
        }
      }
      
      const result = { rowspan: 1, colspan: 1 };
      mergeCache.set(cacheKey, result);
      return result;
    };
  }
  