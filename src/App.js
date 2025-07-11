import React, { useState, useMemo, useEffect } from 'react';

// --- Helper Functions & Constants ---

// A custom hook to manage state that persists in the browser's local storage.
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading from local storage", error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error("Error writing to local storage", error);
    }
  };

  return [storedValue, setValue];
}


const formatCurrency = (value) => {
  if (isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const TIER_MULTIPLIERS = [3, 5, 10];
const INITIAL_RATES = {
  monthly: [0.03, 0.05, 0.10, 0.15],
  quarterly: [0.03, 0.05, 0.10, 0.15],
};
const INITIAL_PERF_DATA = { perf1: '', perf2: '', perf3: '' };

// --- Main Calculation Logic ---
const calculateProgressiveBonus = (performance, type = 'monthly', config) => {
  const { thresholds, rates } = config[type];
  let bonus = 0;
  let remainingPerf = performance;
  let lowerBound = 0;

  for (let i = 0; i < thresholds.length; i++) {
    const upperBound = thresholds[i];
    const rate = rates[i];
    if (remainingPerf <= 0) break;
    const tierRange = upperBound - lowerBound;
    const amountInTier = Math.min(remainingPerf, tierRange);
    bonus += amountInTier * rate;
    remainingPerf -= amountInTier;
    lowerBound = upperBound;
  }

  if (remainingPerf > 0) {
    bonus += remainingPerf * rates[rates.length - 1];
  }
  return bonus;
};

// --- Components ---

const TierTable = ({ type, rates, multipliers, onRateChange }) => {
  const handleInputChange = (index, value) => {
    const newRate = parseFloat(value);
    if (!isNaN(newRate) && newRate >= 0) {
      onRateChange(type, index, newRate / 100);
    }
  };

  const tierRows = [
    { label: `0 ~ ${multipliers[0]}倍月薪`, rate: rates[0], index: 0 },
    { label: `${multipliers[0]} ~ ${multipliers[1]}倍月薪`, rate: rates[1], index: 1 },
    { label: `${multipliers[1]} ~ ${multipliers[2]}倍月薪`, rate: rates[2], index: 2 },
    { label: `${multipliers[2]}倍月薪 以上`, rate: rates[3], index: 3 },
  ];

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-lg mb-3 text-slate-800 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        {type === 'monthly' ? '月結' : '季結'}獎金級距
      </h3>
      <table className="w-full text-sm text-left text-slate-600">
        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
          <tr><th scope="col" className="px-4 py-2 rounded-l-lg">業績區間</th><th scope="col" className="px-4 py-2 rounded-r-lg">獎金率 (%)</th></tr>
        </thead>
        <tbody>
          {tierRows.map((row) => (
            <tr key={row.index} className="bg-white border-b border-slate-200 last:border-b-0">
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2">
                <input type="number" value={row.rate * 100} onChange={(e) => handleInputChange(row.index, e.target.value)} className="w-20 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CalculatorPanel = ({ perfData, onPerfChange, tierConfig }) => {
  const [results, setResults] = useState(null);

  useEffect(() => {
    const p1 = Number(perfData.perf1) || 0;
    const p2 = Number(perfData.perf2) || 0;
    const p3 = Number(perfData.perf3) || 0;
    
    if (p1 === 0 && p2 === 0 && p3 === 0) {
        setResults(null);
        return;
    }

    const bonus1 = calculateProgressiveBonus(p1, 'monthly', tierConfig);
    const bonus2 = calculateProgressiveBonus(p2, 'monthly', tierConfig);
    const bonus3 = calculateProgressiveBonus(p3, 'monthly', tierConfig);
    const totalMonthlyBonus = bonus1 + bonus2 + bonus3;
    const totalQuarterlyPerf = p1 + p2 + p3;
    const quarterlyBonus = calculateProgressiveBonus(totalQuarterlyPerf, 'quarterly', tierConfig);

    setResults({
      monthly: { bonus1, bonus2, bonus3, total: totalMonthlyBonus },
      quarterly: { totalPerf: totalQuarterlyPerf, total: quarterlyBonus },
    });
  }, [perfData, tierConfig]);

  const recommendation = useMemo(() => {
    if (!results) return null;
    const diff = results.quarterly.total - results.monthly.total;
    if (diff > 0) return { style: 'bg-green-100 border-green-500 text-green-800', text: `建議選擇【按季計算】，可多領 ${formatCurrency(diff)}。` };
    if (diff < 0) return { style: 'bg-orange-100 border-orange-500 text-orange-800', text: `建議選擇【按月計算】，可多領 ${formatCurrency(Math.abs(diff))}。` };
    return { style: 'bg-blue-100 border-blue-500 text-blue-800', text: '兩種計算方式結果相同。' };
  }, [results]);

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        輸入季度業績
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-700">第一個月業績</label>
          <input type="number" value={perfData.perf1} onChange={e => onPerfChange('perf1', e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="輸入業績" />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-700">第二個月業績</label>
          <input type="number" value={perfData.perf2} onChange={e => onPerfChange('perf2', e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="輸入業績" />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-slate-700">第三個月業績</label>
          <input type="number" value={perfData.perf3} onChange={e => onPerfChange('perf3', e.target.value)} className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="輸入業績" />
        </div>
      </div>

      {results && (
        <div className="animate-fade-in space-y-6">
          <div className={`p-4 text-center font-bold border-l-4 rounded-r-lg ${recommendation.style}`}>{recommendation.text}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                按月計算
              </h3>
              <div className="space-y-3 text-slate-700">
                <p className="flex justify-between"><span>第一個月獎金:</span> <span className="font-mono">{formatCurrency(results.monthly.bonus1)}</span></p>
                <p className="flex justify-between"><span>第二個月獎金:</span> <span className="font-mono">{formatCurrency(results.monthly.bonus2)}</span></p>
                <p className="flex justify-between"><span>第三個月獎金:</span> <span className="font-mono">{formatCurrency(results.monthly.bonus3)}</span></p>
              </div>
              <hr className="my-4 border-slate-200" />
              <div className="text-lg font-bold flex justify-between items-center text-blue-600"><span>季度總獎金:</span><span className="text-2xl font-mono">{formatCurrency(results.monthly.total)}</span></div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>
                按季計算
              </h3>
              <div className="space-y-3 text-slate-700">
                <p className="flex justify-between"><span>季度總業績:</span> <span className="font-mono">{formatCurrency(results.quarterly.totalPerf)}</span></p>
                <p className="flex justify-between"><span>計算方式:</span> <span className="font-mono text-sm">以總業績套用季度級距</span></p>
              </div>
              <hr className="my-4 border-slate-200" />
              <div className="text-lg font-bold flex justify-between items-center text-green-600 mt-12"><span>季度總獎金:</span><span className="text-2xl font-mono">{formatCurrency(results.quarterly.total)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ResetModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-slate-900">確認重設</h3>
                <p className="mt-2 text-sm text-slate-600">您確定要清除所有已儲存的資料，並還原成預設值嗎？此操作無法復原。</p>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 transition-colors">取消</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">確認清除</button>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [monthlySalary, setMonthlySalary] = useLocalStorage('bonusCalculator_salary', 40000);
  const [tierRates, setTierRates] = useLocalStorage('bonusCalculator_rates', INITIAL_RATES);
  const [perfData, setPerfData] = useLocalStorage('bonusCalculator_perf', INITIAL_PERF_DATA);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const dynamicTierConfig = useMemo(() => {
    const salary = Number(monthlySalary) || 0;
    const monthlyThresholds = TIER_MULTIPLIERS.map(m => m * salary);
    const quarterlyThresholds = monthlyThresholds.map(t => t * 3);
    return {
      monthly: { thresholds: monthlyThresholds, rates: tierRates.monthly },
      quarterly: { thresholds: quarterlyThresholds, rates: tierRates.quarterly },
    };
  }, [monthlySalary, tierRates]);

  const handleRateChange = (type, index, newRate) => {
    setTierRates(prev => {
      const newRates = [...prev[type]];
      newRates[index] = newRate;
      return { ...prev, [type]: newRates };
    });
  };

  const handlePerfChange = (field, value) => {
    setPerfData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSalaryChange = (e) => {
    const newSalary = e.target.value;
    setMonthlySalary(newSalary);
  }

  const handleReset = () => {
    window.localStorage.removeItem('bonusCalculator_salary');
    window.localStorage.removeItem('bonusCalculator_rates');
    window.localStorage.removeItem('bonusCalculator_perf');
    window.location.reload();
  };

  return (
    <div className="bg-slate-100 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">業績獎金計算機</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">比較「按月累進」與「按季累進」的獎金差異</p>
          </div>
          <button onClick={() => setIsResetModalOpen(true)} className="flex items-center px-3 py-2 bg-white border border-slate-300 text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            清除資料
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6 border border-slate-200">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        輸入您的月薪
                    </h3>
                    <input type="number" id="salaryInput" value={monthlySalary} onChange={handleSalaryChange} className="bg-slate-50 border border-slate-300 text-slate-900 text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full max-w-xs p-2.5" placeholder="例如: 40000" />
                </div>
                <hr className="my-6 border-slate-200"/>
                <CalculatorPanel perfData={perfData} onPerfChange={handlePerfChange} tierConfig={dynamicTierConfig} />
            </div>
            <div className="lg:col-span-1 space-y-6">
                <TierTable type="monthly" rates={tierRates.monthly} multipliers={TIER_MULTIPLIERS} onRateChange={handleRateChange} />
                <TierTable type="quarterly" rates={tierRates.quarterly} multipliers={TIER_MULTIPLIERS} onRateChange={handleRateChange} />
            </div>
        </div>
        
        <footer className="text-center text-sm text-slate-500 mt-10 pb-4">
          <p>此計算機依據累進制獎金規則進行模擬。實際獎金發放請以公司最終計算為準。</p>
          <p>&copy; 2024 智慧獎金分析工具</p>
        </footer>
        
        <ResetModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} onConfirm={handleReset} />
      </div>
    </div>
  );
}
