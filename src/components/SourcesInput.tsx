import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';

type SourcesInputProps = {
  sources: string[];
  onSourcesChange: (sources: string[]) => void;
  placeholder?: string;
  label?: string;
};

export default function SourcesInput({
  sources,
  onSourcesChange,
  placeholder = 'Enter URL (must start with http:// or https://)...',
  label = 'Sources',
}: SourcesInputProps) {
  const [inputValue, setInputValue] = useState('');

  const validateUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://');
  };

  const addSource = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !sources.includes(trimmedValue)) {
      if (!validateUrl(trimmedValue)) {
        alert('URL must start with http:// or https://');
        return;
      }
      onSourcesChange([...sources, trimmedValue]);
      setInputValue('');
    }
  };

  const removeSource = (sourceToRemove: string) => {
    const newSources = sources.filter((source) => source !== sourceToRemove);
    onSourcesChange(newSources);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSource();
    }
  };

  return (
    <div className='space-y-2'>
      <label htmlFor='sources' className='text-sm font-semibold'>
        {label}
      </label>
      <div className='space-y-3'>
        <div className='flex gap-2'>
          <Input
            id='sources'
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className='flex-1'
          />
          <Button
            type='button'
            onClick={addSource}
            disabled={!inputValue.trim()}
            size='sm'
            className='px-3'
          >
            <Plus className='h-4 w-4' />
          </Button>
        </div>
        {sources.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {sources.map((source) => (
              <Badge key={source} variant='neutral' className='gap-1'>
                {source}
                <button
                  type='button'
                  onClick={() => removeSource(source)}
                  className='ml-1 hover:bg-foreground/10 rounded-full p-0.5'
                >
                  <X className='h-3 w-3' />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
