import React, { useState, useMemo, useEffect } from 'react';

// --- Helper Functions ---
// Formats a number into Taiwanese currency format (e.g., NT$120,000)
const formatCurrency = (value) => {
  if (isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Initial configuration for bonus tiers. Monthly and Quarterly thresholds and rates.
const INITIAL_TIER_CONFIG = {
  monthly: {
    thresholds: [120000, 200000, 400000],
    rates: [0.03, 0.05, 0.10],
  },
  quarterly: {
    thresholds: [360000, 600000, 1200000],
    rates: [0.03, 0.05, 0.10],
  },
};

// Calculates the bonus based on a progressive (tiered) system.
const calculateProgressiveBonus = (performance, type = 'monthly', config) => {
  const { thresholds, rates } = config[type];
  let bonus = 0;
  let remainingPerf = performance;
  let lowerBound = 0;

  // Loop through each tier
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

  // Calculate for any performance exceeding the highest threshold
  if (remainingPerf > 0) {
    bonus += remainingPerf * rates[rates.length - 1];
  }

  return bonus;
};

// --- Components ---

// Displays the table for bonus tiers and allows editing the rates.
const TierTable = ({ type, config, onRateChange }) => {
  const { rates, thresholds } = config;
  const formattedThresholds = thresholds.map(t => (t / 10000) + '萬');

  const handleInputChange = (index, value) => {
    const newRate = parseFloat(value);
    if (!isNaN(newRate) && newRate >= 0) {
      onRateChange(type, index, newRate / 100);
    }
  };

  const tierRows = [
    { label: `0 ~ ${formattedThresholds[0]}`, rate: rates[0], index: 0 },
    { label: `${formattedThresholds[0]} ~ ${formattedThresholds[1]}`, rate: rates[1], index: 1 },
    { label: `${formattedThresholds[1]} ~ ${formattedThresholds[2]}`, rate: rates[2], index: 2 },
    { label: `${formattedThresholds[2]} 以上`, rate: rates[2], index: 2 },
  ];

  return (
    <div className="bg-gray-50 p-4 rounded-lg border">
      <h3 className="font-bold text-lg mb-3 text-gray-700">{type === 'monthly' ? '月結' : '季結'}獎金級距 (可編輯)</h3>
      <table className="w-full text-sm text-left text-gray-600">
        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
          <tr>
            <th scope="col" className="px-4 py-2">業績區間</th>
            <th scope="col" className="px-4 py-2">獎金率 (%)</th>
          </tr>
        </thead>
        <tbody>
          {tierRows.map((row, i) => (
            <tr key={i} className="bg-white border-b">
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  value={row.rate * 100}
                  onChange={(e) => handleInputChange(row.index, e.target.value)}
                  className="w-20 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5"
                  // The last row's input is a visual representation and is linked to the previous tier.
                  disabled={i === tierRows.length -1}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main panel for inputting performance data and displaying calculation results.
const CalculatorPanel = ({ initialPerf, isCustom, tierConfig, onPerfChange }) => {
  const { perf1, perf2, perf3 } = initialPerf;
  const [results, setResults] = useState(null);

  // Function to perform the bonus calculations
  const calculateResults = () => {
      const p1 = Number(perf1) || 0;
      const p2 = Number(perf2) || 0;
      const p3 = Number(perf3) || 0;

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
  };
  
  // Recalculate whenever performance numbers or the tier configuration changes.
  useEffect(() => {
    if(perf1 !== '' || perf2 !== '' || perf3 !== '' || !isCustom) {
        calculateResults();
    } else {
        setResults(null);
    }
  }, [perf1, perf2, perf3, isCustom, tierConfig]);

  // Memoized recommendation based on the calculation results
  const recommendation = useMemo(() => {
    if (!results) return null;
    const diff = results.quarterly.total - results.monthly.total;
    if (diff > 0) {
      return {
        style: 'bg-green-100 border-green-500 text-green-800',
        text: `建議選擇【按季計算】，可多領 ${formatCurrency(diff)}。`,
      };
    } else if (diff < 0) {
      return {
        style: 'bg-orange-100 border-orange-500 text-orange-800',
        text: `建議選擇【按月計算】，可多領 ${formatCurrency(Math.abs(diff))}。`,
      };
    } else {
      return {
        style: 'bg-blue-100 border-blue-500 text-blue-800',
        text: '兩種計算方式結果相同。',
      };
    }
  }, [results]);

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-900">第一個月業績</label>
          <input type="number" value={perf1} onChange={e => onPerfChange(0, e.target.value)} disabled={!isCustom} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 disabled:bg-gray-200" placeholder="例如: 150000" />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-900">第二個月業績</label>
          <input type="number" value={perf2} onChange={e => onPerfChange(1, e.target.value)} disabled={!isCustom} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 disabled:bg-gray-200" placeholder="例如: 150000" />
        </div>
        <div>
          <label className="block mb-2 text-sm font-medium text-gray-900">第三個月業績</label>
          <input type="number" value={perf3} onChange={e => onPerfChange(2, e.target.value)} disabled={!isCustom} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 disabled:bg-gray-200" placeholder="例如: 150000" />
        </div>
      </div>
      
      {isCustom && (
        <div className="text-center mb-6">
          <button onClick={calculateResults} className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-base px-8 py-3 transition-all duration-200 shadow-md hover:shadow-lg">
            手動計算
          </button>
        </div>
      )}

      {results && (
        <div className="animate-fade-in">
          <div className={`p-4 mb-6 text-center font-bold border-l-4 rounded-r-lg ${recommendation.style}`}>
            {recommendation.text}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">按月計算</h3>
              <div className="space-y-3 text-gray-700">
                <p className="flex justify-between"><span>第一個月獎金:</span> <span className="font-mono">{formatCurrency(results.monthly.bonus1)}</span></p>
                <p className="flex justify-between"><span>第二個月獎金:</span> <span className="font-mono">{formatCurrency(results.monthly.bonus2)}</span></p>
                <p className="flex justify-between"><span>第三個月獎金:</span> <span className="font-mono">{formatCurrency(results.monthly.bonus3)}</span></p>
              </div>
              <hr className="my-4" />
              <div className="text-lg font-bold flex justify-between items-center text-blue-600">
                <span>季度總獎金:</span>
                <span className="text-2xl font-mono">{formatCurrency(results.monthly.total)}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">按季計算</h3>
              <div className="space-y-3 text-gray-700">
                <p className="flex justify-between"><span>季度總業績:</span> <span className="font-mono">{formatCurrency(results.quarterly.totalPerf)}</span></p>
                <p className="flex justify-between"><span>計算方式:</span> <span className="font-mono text-sm">以總業績套用季度級距</span></p>
              </div>
              <hr className="my-4" />
              <div className="text-lg font-bold flex justify-between items-center text-green-600 mt-12">
                <span>季度總獎金:</span>
                <span className="text-2xl font-mono">{formatCurrency(results.quarterly.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// The main App component that ties everything together.
export default function App() {
  const [activeTab, setActiveTab] = useState('example1');
  const [tierConfig, setTierConfig] = useState(INITIAL_TIER_CONFIG);
  
  // State to hold performance data for all tabs
  const [perfData, setPerfData] = useState({
    example1: { perf1: 150000, perf2: 150000, perf3: 150000 },
    example2: { perf1: 210000, perf2: 210000, perf3: 210000 },
    example3: { perf1: 410000, perf2: 410000, perf3: 410000 },
    custom: { perf1: '', perf2: '', perf3: '' },
  });

  // Handler for when bonus rates are changed in the TierTable
  const handleRateChange = (type, index, newRate) => {
    setTierConfig(prevConfig => {
      const newRates = [...prevConfig[type].rates];
      newRates[index] = newRate;
      return {
        ...prevConfig,
        [type]: {
          ...prevConfig[type],
          rates: newRates,
        },
      };
    });
  };

  // Handler for when performance numbers are changed in the custom tab
  const handlePerfChange = (index, value) => {
    setPerfData(prevData => ({
        ...prevData,
        custom: {
            ...prevData.custom,
            [`perf${index + 1}`]: value
        }
    }));
  };

  const tabs = [
    { id: 'example1', label: '情境一: 月均 15萬', isCustom: false },
    { id: 'example2', label: '情境二: 月均 21萬', isCustom: false },
    { id: 'example3', label: '情境三: 月均 41萬', isCustom: false },
    { id: 'custom', label: '自訂計算機', isCustom: true },
  ];

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="container mx-auto p-4">
        <header className="text-center my-6">
          <h1 className="text-4xl font-bold text-gray-800">業績獎金計算機</h1>
          <p className="text-lg text-gray-600 mt-2">比較「按月累進」與「按季累進」的獎金差異</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <div className="mb-4 border-b border-gray-200">
                        <ul className="flex flex-wrap -mb-px text-sm font-medium text-center" role="tablist">
                            {tabs.map(tab => (
                                <li key={tab.id} className="mr-2" role="presentation">
                                    <button
                                        className={`inline-block p-4 border-b-2 rounded-t-lg ${activeTab === tab.id ? 'text-blue-600 border-blue-600' : 'border-transparent hover:text-gray-600 hover:border-gray-300'}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === tab.id}
                                    >
                                        {tab.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <CalculatorPanel 
                            key={activeTab} 
                            initialPerf={perfData[activeTab]} 
                            isCustom={activeTab === 'custom'}
                            tierConfig={tierConfig}
                            onPerfChange={handlePerfChange}
                        />
                    </div>
                </div>
            </div>
            <div className="lg:col-span-1 space-y-6">
                <TierTable type="monthly" config={tierConfig.monthly} onRateChange={handleRateChange} />
                <TierTable type="quarterly" config={tierConfig.quarterly} onRateChange={handleRateChange} />
            </div>
        </div>
        
        <footer className="text-center text-sm text-gray-500 mt-8 pb-4">
          <p>此計算機依據累進制獎金規則進行模擬。實際獎金發放請以公司最終計算為準。</p>
          <p>&copy; 2024 智慧獎金分析工具</p>
        </footer>
      </div>
    </div>
  );
}
