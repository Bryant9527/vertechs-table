<template>
  <div class="excel-import">
    <el-upload
      action=""
      :auto-upload="false"
      :show-file-list="false"
      :on-change="handleFileChange"
      accept=".xlsx,.xls,.csv"
    >
      <el-button type="primary" :loading="loading">
        <el-icon><Upload /></el-icon>
        导入Excel
      </el-button>
    </el-upload>
    
    <!-- 错误提示对话框 -->
    <el-dialog
      v-model="showErrorDialog"
      title="导入错误"
      width="600px"
    >
      <el-alert
        title="以下数据不符合要求，请修正后重新导入"
        type="error"
        :closable="false"
      />
      <el-scrollbar height="300px" class="error-list">
        <el-table :data="formattedErrors" border stripe size="small" max-height="300">
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="row" label="行号" width="80" />
          <el-table-column prop="column" label="列名" width="100" />
          <el-table-column prop="value" label="当前值" width="120" />
          <el-table-column prop="message" label="错误信息" />
        </el-table>
      </el-scrollbar>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showErrorDialog = false">关闭</el-button>
          <el-button type="primary" @click="downloadErrorTemplate">下载错误数据</el-button>
        </div>
      </template>
    </el-dialog>
    
    <!-- 下载模板按钮 -->
    <el-button type="success" @click="downloadTemplate" style="margin-left: 10px;">
      <el-icon><Download /></el-icon>
      下载导入模板
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElUpload, ElButton, ElDialog, ElAlert, ElScrollbar, ElIcon, ElTable, ElTableColumn } from 'element-plus';
import { Upload, Download } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';

// 定义props
interface Props {
  columns: any[];
  validateFn?: (data: any[]) => { valid: boolean; errors?: any[] };
  useCustomColumns?: boolean; // 是否使用自定义列顺序而不是表头匹配
}

const props = withDefaults(defineProps<Props>(), {
  validateFn: undefined,
  useCustomColumns: true // 默认使用自定义列顺序
});

// 定义事件
const emit = defineEmits(['import-success', 'import-error']);

// 状态
const loading = ref(false);
const showErrorDialog = ref(false);
const importErrors = ref<any[]>([]);
const errorData = ref<any[]>([]);
const originalHeaders = ref<string[]>([]);

// 格式化后的错误信息，用于表格展示
const formattedErrors = computed(() => {
  return importErrors.value.map(error => ({
    row: error.rowIndex + 1,
    column: error.columnLabel,
    value: formatValue(error.value),
    message: error.message
  }));
});

// 获取所有列（包括嵌套列）
const getAllColumns = () => {
  const allColumns: any[] = [];
  
  props.columns.forEach(column => {
    if (column.children) {
      allColumns.push(...column.children.filter((subCol: any) => 
        subCol.prop && subCol.prop !== 'operation'
      ));
    } else if (column.prop && column.prop !== 'operation') {
      allColumns.push(column);
    }
  });
  
  return allColumns;
};

// 格式化值，处理特殊类型
const formatValue = (value: any): string => {
  if (value === undefined || value === null) {
    return '空值';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '复杂对象';
    }
  }
  return String(value);
};

// 处理文件变更
const handleFileChange = async (file: any) => {
  if (!file || !file.raw) {
    ElMessage.warning('请选择有效的Excel文件');
    return;
  }
  
  loading.value = true;
  
  try {
    // 读取文件内容
    const arrayBuffer = await file.raw.arrayBuffer();
    
    // 尝试解析Excel
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // 检查是否有工作表
    if (workbook.SheetNames.length === 0) {
      throw new Error('Excel文件中没有工作表');
    }
    
    // 获取第一个工作表
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 转换为JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 检查是否有数据
    if (!jsonData || jsonData.length <= 1) {
      throw new Error('Excel文件中没有足够的数据行');
    }
    
    // 提取表头和数据行
    const headerRow = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as any[][];
    
    console.log('读取到的表头:', headerRow);
    console.log('读取到的数据行数:', dataRows.length);
    
    // 保存原始表头
    originalHeaders.value = headerRow.map(h => String(h || '').trim());
    
    // 处理数据
    let processedData;
    
    if (props.useCustomColumns) {
      // 使用自定义列顺序，忽略表头
      processedData = processDataWithCustomColumns(dataRows);
    } else {
      // 使用表头匹配
      const columnMapping = buildColumnMapping(headerRow);
      
      // 检查列映射是否有效
      if (Object.keys(columnMapping).length === 0) {
        throw new Error('无法匹配Excel表头与表格列');
      }
      
      processedData = processDataWithHeaderMapping(dataRows, columnMapping);
    }
    
    console.log('处理后的数据:', processedData);
    
    // 验证数据
    const validationResult = validateData(processedData);
    
    if (!validationResult.valid) {
      importErrors.value = validationResult.errors || [];
      errorData.value = processedData;
      showErrorDialog.value = true;
      emit('import-error', importErrors.value);
    } else {
      ElMessage.success('导入成功');
      emit('import-success', processedData);
    }
  } catch (error: any) {
    console.error('导入Excel出错:', error);
    ElMessage.error(`导入失败: ${error.message || '请检查Excel文件格式'}`);
    emit('import-error', [{ message: error.message || '未知错误' }]);
  } finally {
    loading.value = false;
  }
};

// 构建列映射（基于表头）
const buildColumnMapping = (headerRow: string[]) => {
  const mapping: Record<number, { prop: string, label: string }> = {};
  const allColumns = getAllColumns();
  
  headerRow.forEach((header, index) => {
    // 处理空表头
    if (!header) return;
    
    // 标准化表头
    const normalizedHeader = String(header).trim().toLowerCase();
    
    // 查找匹配的列
    const matchedColumn = allColumns.find(col => {
      const normalizedLabel = String(col.label).trim().toLowerCase();
      return normalizedLabel === normalizedHeader;
    });
    
    if (matchedColumn) {
      mapping[index] = {
        prop: matchedColumn.prop,
        label: matchedColumn.label
      };
    }
  });
  
  return mapping;
};

// 使用自定义列顺序处理数据（忽略表头）
const processDataWithCustomColumns = (dataRows: any[][]) => {
  const allColumns = getAllColumns();
  
  return dataRows.map(row => {
    const item: Record<string, any> = {};
    
    // 遍历所有列，按照定义的顺序映射数据
    allColumns.forEach((column, index) => {
      // 确保索引在有效范围内
      if (index < row.length) {
        const value = row[index];
        
        // 处理特定类型的列
        if (column.prop === 'salary') {
          item[column.prop] = parseFloat(value) || 0;
        } else if (column.prop === 'joinDate') {
          // 处理日期格式
          item[column.prop] = formatDate(value);
        } else {
          item[column.prop] = value !== undefined ? value : '';
        }
      } else {
        // 如果Excel行中没有对应的列，设置为空值
        item[column.prop] = '';
      }
    });
    
    return item;
  });
};

// 使用表头映射处理数据
const processDataWithHeaderMapping = (dataRows: any[][], columnMapping: Record<number, { prop: string, label: string }>) => {
  return dataRows.map(row => {
    const item: Record<string, any> = {};
    
    Object.entries(columnMapping).forEach(([indexStr, column]) => {
      const index = parseInt(indexStr);
      const value = row[index];
      
      // 处理特定类型的列
      if (column.prop === 'salary') {
        item[column.prop] = parseFloat(value) || 0;
      } else if (column.prop === 'joinDate') {
        // 处理日期格式
        item[column.prop] = formatDate(value);
      } else {
        item[column.prop] = value !== undefined ? value : '';
      }
    });
    
    return item;
  });
};

// 格式化日期
const formatDate = (value: any): string => {
  if (!value) return '';
  
  // 如果已经是YYYY-MM-DD格式，直接返回
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  try {
    // 尝试将Excel日期数值转换为日期对象
    let date: Date;
    
    if (typeof value === 'number') {
      // Excel日期是从1900年1月1日开始的天数
      date = new Date((value - 25569) * 86400 * 1000);
    } else {
      // 尝试解析其他格式的日期
      date = new Date(value);
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return String(value);
    }
    
    // 格式化为YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(value);
  }
};

// 验证数据
const validateData = (data: any[]) => {
  // 如果提供了自定义验证函数，则使用它
  if (props.validateFn) {
    return props.validateFn(data);
  }
  
  // 默认验证逻辑
  const errors: any[] = [];
  const allColumns = getAllColumns();
  
  data.forEach((row, rowIndex) => {
    allColumns.forEach(column => {
      // 跳过不需要验证的列
      if (!column.prop || column.prop === 'operation') return;
      
      const value = row[column.prop];
      let isValid = true;
      let errorMessage = '';
      
      // 1. 检查是否有验证器
      if (column.validator) {
        const result = column.validator(value);
        if (result !== true) {
          isValid = false;
          errorMessage = typeof result === 'string' ? result : `${column.label}格式不正确`;
        }
      } else {
        // 2. 默认检查必填项
        if (value === undefined || value === null || value === '') {
          isValid = false;
          errorMessage = `${column.label}是必填项`;
        }
      }
      
      // 如果验证失败，添加错误信息
      if (!isValid) {
        errors.push({
          rowIndex,
          columnIndex: allColumns.findIndex(col => col.prop === column.prop),
          columnProp: column.prop,
          columnLabel: column.label,
          value,
          message: errorMessage
        });
      }
    });
  });
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { valid: true };
};

// 下载错误数据模板
const downloadErrorTemplate = () => {
  if (errorData.value.length === 0) {
    ElMessage.warning('没有错误数据可下载');
    return;
  }
  
  try {
    // 获取所有列
    const allColumns = getAllColumns();
    
    // 准备表头
    const headers = allColumns.map(col => col.label);
    
    // 准备数据
    const rows = errorData.value.map(row => {
      return allColumns.map(col => row[col.prop] || '');
    });
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '错误数据');
    
    // 导出文件
    XLSX.writeFile(workbook, `错误数据_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    ElMessage.success('错误数据已下载');
  } catch (error) {
    console.error('下载错误数据失败:', error);
    ElMessage.error('下载错误数据失败');
  }
};

// 下载导入模板
const downloadTemplate = () => {
  try {
    // 获取所有列
    const allColumns = getAllColumns();
    
    // 准备表头
    const headers = allColumns.map(col => col.label);
    
    // 创建示例数据（一行）
    const exampleRow = allColumns.map(col => {
      switch (col.prop) {
        case 'name':
          return '张三';
        case 'department':
          return '研发部';
        case 'position':
          return '工程师';
        case 'phone':
          return '13800138000';
        case 'email':
          return 'example@company.com';
        case 'joinDate':
          return '2023-01-01';
        case 'salary':
          return '8000';
        case 'status':
          return '在职';
        default:
          return '';
      }
    });
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');
    
    // 导出文件
    XLSX.writeFile(workbook, `导入模板_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    // ElMessage.success('导入模板已下载');
  } catch (error) {
    console.error('下载模板失败:', error);
    ElMessage.error('下载模板失败');
  }
};

// 在组件挂载时，确保XLSX库正确加载
onMounted(() => {
  // 检查XLSX库是否正确加载
  if (!XLSX || typeof XLSX.read !== 'function') {
    console.error('XLSX库未正确加载');
    ElMessage.error('Excel处理库未正确加载，导入功能可能不可用');
  }
});
</script>

<style scoped>
.excel-import {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.error-list {
  margin-top: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
}
</style>
