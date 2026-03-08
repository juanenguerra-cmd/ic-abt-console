import React from 'react';
import { X, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';

interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface CustomizeDashboardModalProps {
  widgets: WidgetConfig[];
  setWidgets: (widgets: WidgetConfig[]) => void;
  onClose: () => void;
}

export const CustomizeDashboardModal: React.FC<CustomizeDashboardModalProps> = ({ widgets, setWidgets, onClose }) => {
  const toggleVisibility = (index: number) => {
    const newWidgets = [...widgets];
    newWidgets[index].visible = !newWidgets[index].visible;
    setWidgets(newWidgets);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newWidgets = [...widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[index - 1];
    newWidgets[index - 1] = temp;
    setWidgets(newWidgets);
  };

  const moveDown = (index: number) => {
    if (index === widgets.length - 1) return;
    const newWidgets = [...widgets];
    const temp = newWidgets[index];
    newWidgets[index] = newWidgets[index + 1];
    newWidgets[index + 1] = temp;
    setWidgets(newWidgets);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <h3 className="font-bold text-lg text-neutral-900">Customize Dashboard</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 p-1 rounded-full hover:bg-neutral-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-neutral-500 mb-4">
            Toggle visibility and reorder widgets to personalize your dashboard view.
          </p>
          
          <div className="space-y-2">
            {widgets.map((widget, index) => (
              <div 
                key={widget.id} 
                className={`flex items-center justify-between p-3 rounded-lg border ${widget.visible ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 text-neutral-400'}`}
              >
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleVisibility(index)}
                    className={`p-1.5 rounded-md transition-colors ${widget.visible ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-neutral-400 hover:bg-neutral-200'}`}
                    title={widget.visible ? "Hide widget" : "Show widget"}
                  >
                    {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <span className={`font-medium ${widget.visible ? 'text-neutral-900' : 'text-neutral-500'}`}>
                    {widget.label}
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => moveDown(index)}
                    disabled={index === widgets.length - 1}
                    className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 rounded-md disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-neutral-500 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
