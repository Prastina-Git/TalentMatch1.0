import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from 'xlsx';

// ==========================================
// CONFIGURATION
// ==========================================

// PASTE YOUR GOOGLE GEMINI API KEY HERE FOR AZURE HOSTING
const AZURE_API_KEY = ""; 

console.log("App Initializing...");

// --- Types & Interfaces ---

interface Employee {
  id: string;
  name: string;
  primarySkill: string[];
  secondarySkill: string[];
  additionalSkill: string[]; 
  totalExperience: number;
  designation: string;
  location: string;
  joiningStatus: string;
  assignDate: Date | null;
  deploymentStatus: string;
  deploymentStatus1: string;
  availableFrom: string; 
  wfmManager: string;
  originalRow: any;
}

interface FilterState {
  skills: string[]; 
  minExperience: number | '';
  maxExperience: number | '';
  location: string;
  projectStartDate: string;
}

interface ResultFilterState {
  designation: string[]; // Changed to array for multi-select
  location: string;
  minExp: number | '';
  maxExp: number | '';
}

interface ScoredEmployee extends Employee {
  score: number;
  rawSkillScore: number; // For sorting
  expDeviation: number; // For sorting (lower is better)
  matchDetails: string[];
  scoreTooltip: string; // Specific score breakdown
  displayStatus: string; // For filtering (Joined, Immediate, etc.)
}

// --- Constants & Mappings ---

const LOCATION_MAPPING: Record<string, string[]> = {
    'INDIA': ['india', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'mumbai', 'delhi', 'new delhi', 'gurgaon', 'gurugram', 'noida', 'trivandrum', 'thiruvananthapuram', 'kochi', 'cochin', 'kolkata', 'jaipur', 'indore', 'chandigarh', 'coimbatore', 'ahmedabad'],
    'USA': ['usa', 'united states', 'us', 'new york', 'san francisco', 'chicago', 'boston', 'seattle', 'austin', 'dallas', 'atlanta', 'los angeles', 'denver', 'washington', 'nashville', 'franklin'],
    'CANADA': ['canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'mississauga'],
    'ARMENIA': ['armenia', 'yerevan', 'gyumri', 'vanadzor']
};

const SKILL_EXPANSIONS: Record<string, string[]> = {
  // .NET related
  '.net': [
    '.net', 'dotnet', 'dot net', 'vb.net', 'asp.net', 'asp net',
    '.net core', '.netcore', '.net framework', 'c#', 'c sharp',
    '.net with add ons', 'net'
  ],

  // Java related
  'java': [
    'java', 'java 8', 'java 9', 'java 10', 'java 11', 'java 17',
    'core java', 'spring', 'spring boot', 'springboot', 'hibernate',
    'j2ee', 'j2se', 'java with add ons', 'jva'
  ],

  // React
  'react': [
    'react', 'react.js', 'reactjs', 'react js', 'reactjsx', 'react-js'
  ],

  'react native': [
    'react native', 'react-native', 'reactnative', 'reactnativejs'
  ],

  'node.js': [
    'node.js', 'nodejs', 'node js', 'node'
  ],

  'javascript': [
    'javascript', 'js', 'ecmascript', 'es6', 'es7', 'es8', 'es9', 'es10'
  ],

  // Python related
  'python': [
    'python', 'python3', 'python 3', 'django', 'flask', 'tornado',
    'pandas', 'pyspark', 'numpy', 'scipy', 'dle python'
  ],

  // SQL & Databases
  'sql': [
    'sql', 'sql server', 'ms sql server', 'mysql', 'postgresql', 'postgres',
    'oracle sql', 'oracle plsql', 't-sql', 'msbi', 'ssis', 'ssrs', 'msbi/ssis',
    'sql (google big query)', 'etl', 'pentaho', 'snaplogic', 'azure synapse'
  ],

  'dba': ['dba', 'database administrator'],

  // Cloud
  'aws': ['aws', 'amazon web services', 'amazon cloud', 'amazon aws'],
  'azure': ['azure', 'microsoft azure', 'azure cloud', 'azure solution architect'],
  'gcp': ['gcp', 'google cloud', 'google cloud platform'],

  'cloud ops': ['cloud ops', 'cloud operations', 'aws', 'azure', 'gcp'],
  'cloud security': ['cloud security', 'aws security', 'azure security', 'gcp security'],

  // DevOps & Automation
  'devops': [
    'devops', 'dev ops', 'ci/cd', 'continuous integration', 'continuous delivery',
    'continuous deployment', 'jenkins', 'azure devops', 'gitlab ci', 'automation anywhere'
  ],

  'rpa': ['rpa', 'ui path', 'automation anywhere', 'power automate'],

  // Data engineering / Big Data
  'data engineering': [
    'data engineering', 'spark', 'kafka', 'hadoop', 'hadoop big data stack',
    'data engineering stack', 'data engineering - spark', 'data engineering - kafka'
  ],

  'etl': ['etl', 'etl testing', 'ssis', 'ssrs', 'pentaho', 'etl with add ons', 'snaplogic'],

  'data science': ['data science', 'python', 'r', 'pandas', 'numpy', 'scipy', 'gen ai'],

  // QA
  'qa automation': ['qa automation', 'qa automation with add ons', 'selenium', 'cypress'],
  'qa manual': ['qa manual', 'dle qa manual', 'edi testing', 'healthrule'],

  // Frontend / Design
  'angular': ['angular', 'angularjs', 'angular.js', 'angular 2', 'angular 4', 'angular 5', 'angular 6', 'ng'],
  'html/css': ['html', 'css', 'html/css'],
  'ux design': ['ux design', 'user experience design', 'user research'],
  'ui design': ['ui design', 'user interface design'],

  // Salesforce
  'salesforce commerce cloud': ['salesforce commerce cloud'],
  'salesforce health cloud': ['salesforce health cloud'],
  'salesforce service cloud': ['salesforce service cloud'],
  'salesforce marketing cloud': ['salesforce marketing cloud'],
  'salesforce testing': ['salesforce testing'],

  // Mobile
  'android': ['android', 'android development', 'java android', 'kotlin'],
  'ios': ['ios', 'swift', 'swiftui', 'objective-c'],

  // Project & Product
  'project management': ['project management', 'project management(consulting)'],
  'product management': ['product management', 'product management(consulting)'],
  'product owner': ['product owner'],
  'business analyst': ['business analyst', 'business analyst lead', 'lead - business analyst'],
  'senior business analyst': ['senior business analyst'],
  'senior product designer': ['senior product designer'],

  // Others / Misc
  'php': ['php', 'php/laravel', 'php/laravel/codeigniter', 'cakephp', 'php/laravel/codeigniter/cakephp'],
  'sap bo': ['sap bo'],
  'intersystems': ['intersystems', 'qnxt', 'healthedge', 'facets'],
  'ms dynamics': ['ms dynamics', 'ms dynamics with azure'],
  'power bi': ['power bi', 'powerbi'],
  'spotfire': ['spotfire', 'tibco spotfire'],
  'azure data factory': ['azure data factory'],
  'azure databricks': ['azure databricks'],
  'outsystems': ['outsystems', 'low code'],
  'jasper reporting': ['jasper reporting'],
  'performance engineering': ['performance engineering', 'performance testing'],
  'l1 help desk': ['l1 help desk'],
  'l2 help desk': ['l2 help desk'],
  'service now': ['servicenow', 'service now'],
  'control-m': ['control - m', 'control m'],
  'ror': ['ror', 'ruby on rails'],
  'intern': ['intern', 'fresher', 'developer', 'designer', 'architect'],
  'prompt engineer': ['prompt engineer', 'gen ai', 'ai engineer'],
};

const isLocationMatch = (empLoc: string, filterLoc: string): boolean => {
    if (!filterLoc) return true;
    if (!empLoc) return false;
    const normEmp = empLoc.toLowerCase().trim();
    const normFilter = filterLoc.toLowerCase().trim();
    
    // 1. Direct match (case-insensitive)
    if (normEmp === normFilter) return true;
    
    // 2. City to Country Mapping
    const cities = LOCATION_MAPPING[filterLoc.toUpperCase()];
    if (cities && cities.includes(normEmp)) return true;
    
    return false;
};

// --- Canonical Helpers ---

const getCanonicalSkill = (s: string) => {
    const norm = s.toLowerCase().trim();
    // .NET Normalization: .NET, .NET Core, .NET with add ons -> .NET
    if (norm.startsWith('.net') || norm === 'dotnet' || norm === 'dot net') return '.net';
    return norm;
};


// --- Styles ---
const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    backgroundColor: '#0D0359',
    color: 'white',
    padding: '16px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    borderRadius: '8px',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoText: {
    fontFamily: 'Barlow, sans-serif',
    fontWeight: '700',
    fontSize: '28px',
    letterSpacing: '1px',
  },
  logoIcon: {
    position: 'relative' as 'relative',
    width: '32px',
    height: '32px',
  },
  logoBox1: {
    position: 'absolute' as 'absolute',
    bottom: 0,
    left: 0,
    width: '24px',
    height: '24px',
    border: '3px solid white',
    borderRadius: '4px',
  },
  logoBox2: {
    position: 'absolute' as 'absolute',
    top: 0,
    right: 0,
    width: '20px',
    height: '20px',
    backgroundColor: '#0FE4BD',
    borderRadius: '0 6px 0 0',
  },
  appName: {
    fontSize: '20px',
    fontWeight: '300',
    letterSpacing: '0.5px',
    borderLeft: '1px solid rgba(255,255,255,0.3)',
    paddingLeft: '16px',
    marginLeft: '4px'
  },
  main: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '24px',
    marginTop: '24px',
  },
  splitLayout: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap' as 'wrap',
    alignItems: 'flex-start',
  },
  searchPanelWrapper: {
    flex: '2 1 600px', 
    minWidth: '300px',
  },
  aiPanelWrapper: {
    flex: '1 1 350px', 
    minWidth: '300px',
  },
  searchPanel: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    height: '100%',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#0D0359',
    marginBottom: '8px',
    display: 'flex', 
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#0D0359',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    fontFamily: 'Barlow, sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    fontFamily: 'Barlow, sans-serif',
    backgroundColor: 'white',
  },
  buttonPrimary: {
    backgroundColor: '#0FE4BD',
    color: '#0D0359',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    minWidth: '150px',
    transition: 'transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  textButtonDark: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#0D0359',
    padding: '10px 16px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '32px',
    alignItems: 'center',
    flexWrap: 'wrap' as 'wrap',
  },
  card: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column' as 'column',
    position: 'relative' as 'relative',
    transition: 'transform 0.2s',
  },
  cardLabel: {
    color:'#888', 
    display:'flex', 
    alignItems: 'center', 
    gap: '6px', 
    fontSize: '11px', 
    fontWeight: '600',
    marginBottom: '4px',
    letterSpacing: '0.5px'
  },
  cardIcon: {
    fontSize: '16px',
    color: '#0FE4BD'
  },
  matchScore: {
    position: 'absolute' as 'absolute',
    top: '24px',
    right: '24px',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#0D0359',
    cursor: 'help', // Indicates hover info
  },
  tag: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    marginRight: '6px',
    marginBottom: '6px',
    backgroundColor: '#F0F2F5',
    color: '#555',
  },
  tagPrimary: {
    backgroundColor: '#E8E6F5',
    color: '#0D0359',
    fontWeight: '500',
  },
  aiSection: {
    backgroundColor: '#0D0359', // Indigo
    padding: '24px',
    borderRadius: '12px',
    color: 'white',
    boxShadow: '0 4px 12px rgba(13, 3, 89, 0.15)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as 'column'
  },
  aiHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '16px',
  },
  aiIconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0FE4BD', // Teal icon
  },
  aiTextArea: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '16px',
    color: 'white',
    fontFamily: 'Barlow, sans-serif',
    fontSize: '16px',
    minHeight: '100px',
    resize: 'vertical' as 'vertical',
    outline: 'none',
    marginBottom: '16px',
    flex: 1, 
  },
  aiFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '16px',
    marginTop: 'auto', // Push to bottom
  },
  textButtonLight: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.8)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    whiteSpace: 'nowrap' as 'nowrap', // Prevent wrapping
    minWidth: '100px', // Ensure it's long enough
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '8px',
  },
  fileUploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    padding: '10px 16px',
    backgroundColor: '#f0f2f5',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#555',
    marginRight: 'auto',
  },
  content: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '24px',
  },
  modalOverlay: {
    position: 'fixed' as 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '12px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto' as 'auto',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    position: 'relative' as 'relative'
  },
  modalClose: {
    position: 'absolute' as 'absolute',
    top: '24px',
    right: '24px',
    border: 'none',
    background: 'transparent',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#555'
  },
  // Result Filter Bar
  refineBar: {
    display: 'flex',
    flexWrap: 'wrap' as 'wrap',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid #eee',
    alignItems: 'center'
  },
  refineItem: {
    display: 'flex',
    flexDirection: 'column' as 'column',
    gap: '4px',
    minWidth: '140px',
    flex: '1 1 140px'
  },
  refineLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#0D0359',
    textTransform: 'uppercase' as 'uppercase'
  },
  refineSelect: {
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '13px',
    fontFamily: 'Barlow, sans-serif'
  },
  refineInput: {
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '13px',
    fontFamily: 'Barlow, sans-serif',
    width: '100%'
  }
};

// --- Helper Components ---

const MultiSelect = ({ options, selected, onChange, placeholder }: { options: string[], selected: string[], onChange: (val: string[]) => void, placeholder: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const removeTag = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(s => s !== tag));
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div 
        style={{
          ...styles.select, 
          minHeight: '42px', 
          display: 'flex', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '4px',
          cursor: 'pointer'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0 && <span style={{ color: '#aaa' }}>{placeholder}</span>}
        {selected.map(tag => (
          <span key={tag} style={{
            backgroundColor: '#E8E6F5',
            color: '#0D0359',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {tag}
            <span onClick={(e) => removeTag(tag, e)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>▼</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: '250px',
          overflowY: 'auto',
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          zIndex: 1000,
          marginTop: '4px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
            <input 
              type="text" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ ...styles.input, padding: '6px' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <div 
                key={opt}
                onClick={() => toggleOption(opt)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: selected.includes(opt) ? '#F0F7FF' : 'white',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selected.includes(opt) ? '#F0F7FF' : 'white'}
              >
                <input 
                  type="checkbox" 
                  checked={selected.includes(opt)} 
                  readOnly 
                  style={{ pointerEvents: 'none' }}
                />
                {opt}
              </div>
            ))
          ) : (
            <div style={{ padding: '12px', color: '#888', fontSize: '14px', textAlign: 'center' }}>No options found</div>
          )}
        </div>
      )}
    </div>
  );
};

// Help Modal Component
const HelpModal = ({ onClose }: { onClose: () => void }) => {
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <button style={styles.modalClose} onClick={onClose}>×</button>
                <h2 style={{ color: '#0D0359', marginTop: 0 }}>Talent Match - Documentation</h2>
                
                <h3 style={{ color: '#0FE4BD' }}>1. Use Case Overview</h3>
                <p><strong>Talent Match</strong> is an intelligent resource management tool designed to optimize the utilization of the "Launchpad" (Bench). It allows Resource Managers and Delivery Leads to quickly identify suitable candidates for upcoming projects by matching skills, experience, designation, and availability against a live Excel dataset.</p>
                
                <h3 style={{ color: '#0FE4BD' }}>2. Key Functionality</h3>
                <ul>
                    <li><strong>Skills Search:</strong> Unified search across Primary, Secondary, and Additional skills.</li>
                    <li><strong>Experience Range:</strong> Filter candidates by a minimum and maximum years of experience.</li>
                    <li><strong>Location Intelligence:</strong> Smart mapping of cities (e.g., "Bangalore") to regions ("INDIA").</li>
                    <li><strong>Availability Check:</strong> Validates candidates against future project start dates.</li>
                    <li><strong>AI Assistant:</strong> Natural language search powered by Google Gemini.</li>
                </ul>

                <h3 style={{ color: '#0FE4BD' }}>3. Business Rules</h3>
                <ul>
                    <li><strong>Exclusions:</strong> Automatically hides employees marked as "Earmarked" or "Going on ML".</li>
                    <li><strong>Threshold:</strong> Candidates with a match score below 40% are not shown.</li>
                </ul>

                <h3 style={{ color: '#0FE4BD' }}>4. Match Scoring Algorithm</h3>
                <p>The <strong>Match Score (0-100%)</strong> is calculated as follows:</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Criterion</th>
                            <th style={{ padding: '8px' }}>Weight</th>
                            <th style={{ padding: '8px' }}>Logic</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}><strong>Skills</strong></td>
                            <td style={{ padding: '8px' }}>50%</td>
                            <td style={{ padding: '8px' }}>Primary (1.0), Secondary (0.7), Additional (0.5)</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}><strong>Experience</strong></td>
                            <td style={{ padding: '8px' }}>30%</td>
                            <td style={{ padding: '8px' }}>Full score if exact match. Score reduces by 25% for every year deviation (up to 3 years).</td>
                        </tr>
                        <tr style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}><strong>Availability</strong></td>
                            <td style={{ padding: '8px' }}>20%</td>
                            <td style={{ padding: '8px' }}><strong>Joined/Immediate:</strong> 20pts.<br /><strong>YTR (On Time):</strong> 15pts.<br /><strong>YTR (Late):</strong> 5pts.</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- Main App Component ---

const App = () => {
  const [data, setData] = useState<Employee[]>([]);
  const [uniqueSkills, setUniqueSkills] = useState<string[]>([]);
  const [uniqueDesignations, setUniqueDesignations] = useState<string[]>([]);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  
  // App State
  const [filters, setFilters] = useState<FilterState>({
    skills: [],
    minExperience: '',
    maxExperience: '',
    location: '',
    projectStartDate: '',
  });

  const [searchResults, setSearchResults] = useState<ScoredEmployee[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('match');
  const [showHelp, setShowHelp] = useState(false);
  const [sourceFile, setSourceFile] = useState<string>('Not Loaded');
  
  // Result Filter State
  const [resultFilter, setResultFilter] = useState<ResultFilterState>({
      designation: [],
      location: '',
      minExp: '',
      maxExp: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load default data on mount
  useEffect(() => {
    loadDefaultData();
  }, []);

  const loadDefaultData = async () => {
    try {
        setLoading(true);
        // Use the exact file name and handle spaces with %20
        const fileName = 'Launchpad Joined_Yet to join.xlsx';
        // Add timestamp to prevent caching
        const response = await fetch(`./${fileName}?t=${new Date().getTime()}`);
        
        if (!response.ok) {
            console.warn(`Could not find '${fileName}'. Status: ${response.status}`);
            setLoading(false);
            return;
        }
        
        const blob = await response.blob();
        const file = new File([blob], fileName);
        await processData(file);
    } catch (error) {
        console.error("Error loading default data:", error);
    } finally {
        setLoading(false);
    }
  };

  const processData = async (file: File) => {
    setLoading(true);
    setSourceFile(file.name);
    
    // Reset Everything
    setSearchResults([]);
    setHasSearched(false);
    setFilters({
        skills: [],
        minExperience: '',
        maxExperience: '',
        location: '',
        projectStartDate: ''
    });
    setResultFilter({ designation: [], location: '', minExp: '', maxExp: '' });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // Target specific sheet or fallback to first
        const targetSheetName = "Launchpad_Joined_Yet to join";
        // Case insensitive match for sheet name
        const foundSheetName = workbook.SheetNames.find(n => n.toLowerCase() === targetSheetName.toLowerCase()) || workbook.SheetNames[0];
        
        console.log(`Loading sheet: ${foundSheetName}`);
        
        const sheet = workbook.Sheets[foundSheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const findColumnValue = (row: any, ...possibleNames: string[]) => {
            for (const name of possibleNames) {
                // Exact match
                if (row[name] !== undefined) return row[name];
                
                // Fuzzy match (ignore case/space)
                const key = Object.keys(row).find(k => k.toLowerCase().replace(/\s+/g, '') === name.toLowerCase().replace(/\s+/g, ''));
                if (key !== undefined) return row[key];
            }
            return undefined;
        };

        const employees: Employee[] = jsonData.map((row: any, index: number) => {
           const empName = findColumnValue(row, 'Employee Name', 'Name') || 'Unknown';
           const empId = findColumnValue(row, 'Employee ID', 'ID') || `EMP-${index}`;
           
           // Helper to clean strings
           const cleanStr = (val: any) => typeof val === 'string' ? val.trim() : (val ? String(val).trim() : '');
           
           // Skills
           const pSkill = cleanStr(findColumnValue(row, 'Primary Skill'));
           const sSkill = cleanStr(findColumnValue(row, 'Secondary Skill', 'Secondary'));
           const aSkill = cleanStr(findColumnValue(row, 'Additional Skill', 'Additional Skills'));
           
           const pSkills = pSkill ? pSkill.split(',').map((s: string) => s.trim()) : [];
           const sSkills = sSkill ? sSkill.split(',').map((s: string) => s.trim()) : [];
           const aSkills = aSkill ? aSkill.split(',').map((s: string) => s.trim()) : [];
           
           // Experience
           const expVal = findColumnValue(row, 'Total experience (Yrs)', 'Total Experience', 'Exp');
           const exp = typeof expVal === 'number' ? expVal : parseFloat(expVal) || 0;

           // Dates
           const assignDateRaw = findColumnValue(row, 'Assign Date');
           let assignDate: Date | null = null;
           if (assignDateRaw instanceof Date) assignDate = assignDateRaw;
           else if (assignDateRaw) assignDate = new Date(assignDateRaw);

           return {
             id: String(empId),
             name: cleanStr(empName),
             primarySkill: pSkills,
             secondarySkill: sSkills,
             additionalSkill: aSkills,
             totalExperience: exp,
             designation: cleanStr(findColumnValue(row, 'Designation')),
             location: cleanStr(findColumnValue(row, 'Location')),
             joiningStatus: cleanStr(findColumnValue(row, 'Joining Status')),
             assignDate: assignDate,
             deploymentStatus: cleanStr(findColumnValue(row, 'Deployment Status')),
             deploymentStatus1: cleanStr(findColumnValue(row, 'Deployment Status 1')),
             availableFrom: cleanStr(findColumnValue(row, 'Available From')),
             wfmManager: cleanStr(findColumnValue(row, 'New WFM Manager', 'WFM Manager')),
             originalRow: row
           };
        });

        // Exclusions: Case Insensitive
        const filteredEmployees = employees.filter(emp => {
            const d1 = emp.deploymentStatus1.toLowerCase();
            const d = emp.deploymentStatus.toLowerCase();
            if (d1 === 'earmarked') return false;
            if (d === 'going on ml') return false;
            return true;
        });

        setData(filteredEmployees);

        // Extract Unique Values
        const skillsSet = new Set<string>();
        const desSet = new Set<string>();
        const locSet = new Set<string>();

        filteredEmployees.forEach(emp => {
            [...emp.primarySkill, ...emp.secondarySkill, ...emp.additionalSkill].forEach(s => {
                if(s) skillsSet.add(s);
            });
            if (emp.designation) desSet.add(emp.designation);
            if (emp.location) locSet.add(emp.location);
        });

        setUniqueSkills(Array.from(skillsSet).sort());
        setUniqueDesignations(Array.from(desSet).sort());
        setUniqueLocations(Array.from(locSet).sort());
        setLoading(false);

      } catch (error) {
        console.error("Error parsing excel:", error);
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processData(e.target.files[0]);
    }
  };

  const handleClearAll = () => {
      setFilters({
          skills: [],
          minExperience: '',
          maxExperience: '',
          location: '',
          projectStartDate: ''
      });
      setAiQuery('');
      setSearchResults([]);
      setHasSearched(false);
      setResultFilter({ designation: [], location: '', minExp: '', maxExp: '' });
  };
  
  const handleAIQuery = async () => {
    // Priority: Manual Azure Key > AI Studio Env Key
    // @ts-ignore
    const apiKey = AZURE_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        alert("API Key is missing. Please paste your Google API Key in index.tsx for Azure hosting.");
        return;
    }
    if (!aiQuery.trim()) return;

    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const prompt = `
      Current Date: ${todayStr} (YYYY-MM-DD).
      
      Extract search filters from the user query: "${aiQuery}".
      
      The available skills are: ${uniqueSkills.join(', ')}.
      The available locations are: ${uniqueLocations.join(', ')}.
      
      Return a JSON object with:
      - skills: Array of strings (map to closest available skills. If query mentions "Java", return ["Java"]).
      - minExperience: number or null.
      - maxExperience: number or null.
      - location: string (one from available locations, or null).
      - projectStartDate: string (YYYY-MM-DD) or null.
      
      Rules:
      1. Map cities to countries (e.g. Bangalore -> INDIA).
      2. If location is not in available list or mapped, return null.
      3. If no experience mentioned, return null.
      4. If user says "available next week" or "starts on date", calculate the date.
      5. Ignore "Designation" or "Role" in the output, only extract skills, experience, location, date.
      6. Do NOT guess. If info is missing, use null.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const extracted = JSON.parse(response.text || "{}");
      console.log("AI Extracted:", extracted);

      if (!extracted.skills?.length && !extracted.location && !extracted.minExperience && !extracted.projectStartDate) {
          alert("No matching criteria found in your request. Please try again.");
          setIsAiLoading(false);
          return;
      }

      // Sanitize AI Output
      const newFilters = { ...filters };

      // Skills: Map to canonical with expansion logic
      if (extracted.skills && Array.isArray(extracted.skills)) {
          const validSkills: string[] = [];
          extracted.skills.forEach((s: string) => {
               const raw = s.toLowerCase().trim();
               let mapped = raw;

               // Reverse Lookup: Check if this skill belongs to a known expansion group
               // If AI returns "reactjs", we want to map it to "react" so we search for the whole group.
               const groupKey = Object.keys(SKILL_EXPANSIONS).find(key => {
                   // Check if key matches
                   if (key === raw) return true;
                   // Check if value list contains raw
                   return SKILL_EXPANSIONS[key].includes(raw);
               });

               if (groupKey) {
                   mapped = groupKey;
               } else {
                   // Fallback to existing normalization
                   mapped = getCanonicalSkill(raw);
               }
               
               // Verification: Does this mapped skill exist in our universe?
               // It's valid if it's an expansion key OR it exists in the dataset
               const isExpansionKey = !!SKILL_EXPANSIONS[mapped];
               
               // Check dataset fuzzy existence
               const existsInDataset = uniqueSkills.some(us => {
                   const uNorm = getCanonicalSkill(us);
                   return uNorm === mapped || us.toLowerCase().includes(mapped);
               });

               if (isExpansionKey || existsInDataset) {
                   validSkills.push(mapped);
               }
          });
          newFilters.skills = [...new Set(validSkills)];
      }

      // Location: Normalize
      if (extracted.location) {
          if (uniqueLocations.includes(extracted.location.toUpperCase())) {
              newFilters.location = extracted.location.toUpperCase();
          } else {
             // Try Smart Map
             const mapped = Object.keys(LOCATION_MAPPING).find(key => isLocationMatch(extracted.location, key));
             if (mapped) newFilters.location = mapped;
          }
      }

      // Experience
      if (typeof extracted.minExperience === 'number') newFilters.minExperience = extracted.minExperience;
      if (typeof extracted.maxExperience === 'number') newFilters.maxExperience = extracted.maxExperience;

      // Date
      if (extracted.projectStartDate && /^\d{4}-\d{2}-\d{2}$/.test(extracted.projectStartDate)) {
          newFilters.projectStartDate = extracted.projectStartDate;
      }

      setFilters(newFilters);
      handleSearch(newFilters);

    } catch (error) {
      console.error("AI Error:", error);
      alert("Could not process AI request. Check console/API Key.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const calculateScore = (emp: Employee, currentFilters: FilterState): ScoredEmployee | null => {
    let skillScore = 0;
    let expScore = 0;
    let availScore = 0;
    
    // 1. Skill Match (50%)
    let totalSkillPoints = 0;
    const requestedSkillsCount = currentFilters.skills.length;
    const matchedDetails: string[] = [];
    let hasAtLeastOneSkill = requestedSkillsCount === 0; // If no skills requested, pass check

    if (requestedSkillsCount > 0) {
        let earnedPoints = 0;
        
        currentFilters.skills.forEach(reqSkill => {
            const canonicalReq = getCanonicalSkill(reqSkill);
            const expansionList = SKILL_EXPANSIONS[canonicalReq] || [canonicalReq];

            const isSkillMatch = (s: string) => {
                const normS = getCanonicalSkill(s);
                return expansionList.some(term => {
                    if (term.length <= 3) return normS === term; // Exact match for short terms
                    return normS.includes(term); // Partial match for longer terms
                });
            };

            let found = false;
            // Check Primary
            if (emp.primarySkill.some(isSkillMatch)) {
                earnedPoints += 1.0;
                matchedDetails.push(`Primary: ${reqSkill}`);
                found = true;
            } 
            // Check Secondary
            else if (emp.secondarySkill.some(isSkillMatch)) {
                earnedPoints += 0.7;
                matchedDetails.push(`Secondary: ${reqSkill}`);
                found = true;
            }
            // Check Additional
            else if (emp.additionalSkill.some(isSkillMatch)) {
                earnedPoints += 0.5;
                matchedDetails.push(`Additional: ${reqSkill}`);
                found = true;
            }

            if (found) hasAtLeastOneSkill = true;
        });

        // Cap at 100% of weight if user has more skills than requested (unlikely but safe)
        skillScore = (earnedPoints / requestedSkillsCount) * 50;
        if (skillScore > 50) skillScore = 50;
        
        totalSkillPoints = earnedPoints; // for tooltip only
    } else {
        // If no skills filter, give full points? No, usually 0 but we rely on other filters
        skillScore = 0; 
    }

    if (!hasAtLeastOneSkill) return null; // STRICT FILTER

    // 2. Experience Match (30%)
    // Filter Logic: Strict Range (handled in search loop)
    // Scoring Logic: Full 30 points if within range (deviation 0).
    // If we wanted soft match, we would calculate deviation.
    // Current requirement: "The one closer to years of experience should be displayed first"
    // Deviation = Math.abs(emp.totalExperience - Target);
    
    // We define target as the MIDPOINT of the range requested, or the exact value if min=max
    let expDeviation = 0;
    if (currentFilters.minExperience !== '' || currentFilters.maxExperience !== '') {
        const min = currentFilters.minExperience === '' ? 0 : Number(currentFilters.minExperience);
        const max = currentFilters.maxExperience === '' ? 100 : Number(currentFilters.maxExperience);
        
        // Strict Filter check (Redundant if done in handleSearch, but good for safety)
        if (emp.totalExperience < min || emp.totalExperience > max) return null;

        // Score Calculation
        // Perfect score (30) if within range. 
        // BUT to sort "Closer is better", we shouldn't punish score if inside range?
        // Let's deduce points if it's on the edge? No, usually Range means "Qualified".
        // Let's give full 30 points, but calculate Deviation for SORTING tie-breaker.
        // Deviation: Distance from Range Center? Or Distance from Min?
        // Let's assume Distance from Min is usually preferred (cheaper)? Or Mid?
        // Let's use 0 deviation for score, but calculated for sort.
        expScore = 30; 
        
        // However, user said: "Score reduces by 25% for every year deviation"
        // This usually applies if we ALLOW people outside range. Since we filter strictly, everyone gets 30.
        // Let's just calculate deviation for Sorting priority.
        const target = (min + max) / 2;
        expDeviation = Math.abs(emp.totalExperience - target);
    } else {
        expScore = 0; // Neutral if not searching exp
    }


    // 3. Availability Match (20%)
    // Tier 1: Joined (20pts)
    // Tier 2: YTR On Time (15pts)
    // Tier 3: YTR Late (5pts)
    // Fallback: Immediate (20pts)
    
    // Determine Status
    let status = 'Unknown';
    if (emp.joiningStatus?.toLowerCase() === 'joined') status = 'Joined';
    else if (emp.availableFrom?.toLowerCase().includes('immediate')) status = 'Immediate';
    else if (emp.joiningStatus?.toLowerCase() === 'ytr') status = 'YTR';

    if (status === 'Joined' || status === 'Immediate') {
        availScore = 20;
    } else if (status === 'YTR') {
        if (currentFilters.projectStartDate && emp.assignDate) {
             const projDate = new Date(currentFilters.projectStartDate);
             // If Assign Date <= Proj Date (Available on time)
             if (emp.assignDate <= projDate) {
                 availScore = 15;
                 status = 'YTR (Available)';
             } else {
                 availScore = 5;
                 status = 'YTR (Late)';
             }
        } else {
            availScore = 15; // Assume available if no date checked
            status = 'YTR';
        }
    } else {
        availScore = 0;
    }

    const totalScore = skillScore + expScore + availScore;
    
    // Tooltip Construction
    const tooltip = `Skills: ${skillScore.toFixed(1)}/50\nExperience: ${expScore.toFixed(1)}/30\nAvailability: ${availScore.toFixed(1)}/20`;

    return {
        ...emp,
        score: totalScore,
        rawSkillScore: skillScore,
        expDeviation: expDeviation,
        matchDetails: matchedDetails,
        scoreTooltip: tooltip,
        displayStatus: status
    };
  };

  const handleSearch = (filtersOverride?: FilterState) => {
    const activeFilters = filtersOverride || filters;
    setHasSearched(true);
    
    let results = data.map(emp => calculateScore(emp, activeFilters)).filter((emp): emp is ScoredEmployee => emp !== null);

    // Filter Logic (Strict)
    results = results.filter(emp => {
        // Location
        if (activeFilters.location && !isLocationMatch(emp.location, activeFilters.location)) return false;
        
        // Threshold
        if (emp.score < 40) return false;

        return true;
    });

    sortResults(results, sortBy);
    setResultFilter({ designation: [], location: '', minExp: '', maxExp: '' });
  };

  const sortResults = (results: ScoredEmployee[], criteria: string) => {
      const sorted = [...results].sort((a, b) => {
          if (criteria === 'designation') return a.designation.localeCompare(b.designation);
          if (criteria === 'exp_low') return a.totalExperience - b.totalExperience;
          if (criteria === 'exp_high') return b.totalExperience - a.totalExperience;
          
          // Default: Match Score (Smart Sort)
          // 1. Skill Score High to Low
          if (Math.abs(b.rawSkillScore - a.rawSkillScore) > 1) {
              return b.rawSkillScore - a.rawSkillScore;
          }
          // 2. Exp Deviation Low to High (Closer is better)
          if (Math.abs(a.expDeviation - b.expDeviation) > 0.5) {
              return a.expDeviation - b.expDeviation;
          }
          // 3. Total Score
          return b.score - a.score;
      });
      setSearchResults(sorted);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setSortBy(val);
      sortResults(searchResults, val);
  };

  // --- Local Result Filtering ---
  const filteredResults = useMemo(() => {
      return searchResults.filter(emp => {
          if (resultFilter.designation.length > 0 && !resultFilter.designation.includes(emp.designation)) return false;
          if (resultFilter.location && emp.location !== resultFilter.location) return false;
          if (resultFilter.minExp !== '' && emp.totalExperience < Number(resultFilter.minExp)) return false;
          if (resultFilter.maxExp !== '' && emp.totalExperience > Number(resultFilter.maxExp)) return false;
          return true;
      });
  }, [searchResults, resultFilter]);

  // Derived unique values for result filters
  // Dynamic Faceted Search Logic:
  // Options for Designation depend on Location/Exp filters
  // Options for Location depend on Designation/Exp filters
  const resDesignations = useMemo(() => {
      const relevant = searchResults.filter(emp => {
          if (resultFilter.location && emp.location !== resultFilter.location) return false;
          if (resultFilter.minExp !== '' && emp.totalExperience < Number(resultFilter.minExp)) return false;
          if (resultFilter.maxExp !== '' && emp.totalExperience > Number(resultFilter.maxExp)) return false;
          return true;
      });
      return Array.from(new Set(relevant.map(r => r.designation))).filter(Boolean).sort();
  }, [searchResults, resultFilter.location, resultFilter.minExp, resultFilter.maxExp]);

  const resLocations = useMemo(() => {
      const relevant = searchResults.filter(emp => {
          if (resultFilter.designation.length > 0 && !resultFilter.designation.includes(emp.designation)) return false;
          if (resultFilter.minExp !== '' && emp.totalExperience < Number(resultFilter.minExp)) return false;
          if (resultFilter.maxExp !== '' && emp.totalExperience > Number(resultFilter.maxExp)) return false;
          return true;
      });
      return Array.from(new Set(relevant.map(r => r.location))).filter(Boolean).sort();
  }, [searchResults, resultFilter.designation, resultFilter.minExp, resultFilter.maxExp]);

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logoGroup}>
           <div style={styles.logoIcon}>
             <div style={styles.logoBox1}></div>
             <div style={styles.logoBox2}></div>
           </div>
           <span style={styles.logoText}>EMIDS</span>
           <span style={styles.appName}>Talent Match</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => fileInputRef.current?.click()}>
                <span className="material-icons">upload_file</span> <span style={{fontSize: '14px', fontWeight: 500}}>Upload</span>
            </button>
            <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowHelp(true)}>
                <span className="material-icons">help_outline</span> Help
            </button>
            <input 
              id="file-upload" 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload} 
              style={{ display: 'none' }}
              accept=".xlsx"
            />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main style={styles.main}>
        
        <div style={styles.splitLayout}>
            {/* LEFT: FILTERS */}
            <div style={styles.searchPanelWrapper}>
                <div style={styles.searchPanel}>
                    <div style={styles.sectionTitle}>
                        <span className="material-icons">filter_list</span>
                        Filter Candidates
                    </div>
                    
                    <div style={styles.filterGrid}>
                        {/* SKILLS */}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={styles.label}>SKILLS</label>
                            <MultiSelect 
                                options={uniqueSkills} 
                                selected={filters.skills} 
                                onChange={(val) => setFilters({...filters, skills: val})} 
                                placeholder="Select Skills (e.g. Java, React)"
                            />
                        </div>

                        {/* EXPERIENCE RANGE */}
                        <div>
                            <label style={styles.label}>YEARS OF EXPERIENCE</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                    type="number" 
                                    placeholder="Min" 
                                    min="0"
                                    style={styles.input}
                                    value={filters.minExperience}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                                        setFilters({...filters, minExperience: val});
                                    }}
                                    onBlur={() => {
                                        if (filters.minExperience !== '' && filters.maxExperience !== '' && Number(filters.minExperience) > Number(filters.maxExperience)) {
                                            setFilters({...filters, maxExperience: filters.minExperience});
                                        }
                                    }}
                                />
                                <span style={{ color: '#888' }}>-</span>
                                <input 
                                    type="number" 
                                    placeholder="Max" 
                                    min="0"
                                    title="If Max is less than Min, it will auto-update to Min"
                                    style={styles.input}
                                    value={filters.maxExperience}
                                    onChange={(e) => {
                                         const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                                         setFilters({...filters, maxExperience: val});
                                    }}
                                    onBlur={() => {
                                        if (filters.minExperience !== '' && filters.maxExperience !== '' && Number(filters.maxExperience) < Number(filters.minExperience)) {
                                            setFilters({...filters, maxExperience: filters.minExperience});
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* LOCATION */}
                        <div>
                            <label style={styles.label}>LOCATION</label>
                            <select 
                                style={styles.select}
                                value={filters.location}
                                onChange={(e) => setFilters({...filters, location: e.target.value})}
                            >
                                <option value="">Any Location</option>
                                {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>

                        {/* PROJECT DATE */}
                        <div>
                            <label style={styles.label}>EXPECTED START DATE</label>
                            <input 
                                type="date" 
                                style={styles.input}
                                min={new Date().toISOString().split('T')[0]} // Block past dates
                                value={filters.projectStartDate}
                                onChange={(e) => setFilters({...filters, projectStartDate: e.target.value})}
                            />
                        </div>
                    </div>

                    <div style={styles.actionRow}>
                        <button style={styles.textButtonDark} onClick={handleClearAll}>
                            <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
                            Clear Filters
                        </button>
                        <button style={styles.buttonPrimary} onClick={() => handleSearch()}>
                            <span className="material-icons">search</span>
                            Search Candidates
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT: AI ASSISTANT */}
            <div style={styles.aiPanelWrapper}>
                <div style={styles.aiSection}>
                    <div style={styles.aiHeader}>
                        <div style={styles.aiIconBox}>
                            <span className="material-icons" style={{ fontSize: '24px' }}>auto_awesome</span>
                        </div>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '18px' }}>AI Assistant</div>
                            <div style={{ fontSize: '12px', opacity: 0.8 }}>Auto-fill filters</div>
                        </div>
                    </div>
                    
                    <textarea
                        style={styles.aiTextArea}
                        placeholder="I need a senior Java developer"
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                    />

                    <div style={styles.aiFooter}>
                        <button style={styles.textButtonLight} onClick={handleClearAll}>
                            <span className="material-icons" style={{ fontSize: '16px' }}>backspace</span>
                            Clear Input
                        </button>
                        <button 
                            style={{ ...styles.buttonPrimary, padding: '10px 16px', minWidth: '130px', fontSize: '14px' }} 
                            onClick={handleAIQuery}
                            disabled={isAiLoading}
                        >
                             <span className="material-icons" style={{ fontSize: '18px' }}>search</span>
                            {isAiLoading ? 'Thinking...' : 'Find Talent'}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* RESULTS SECTION */}
        {hasSearched && (
             <div style={styles.content}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <h3 style={{ margin: 0, color: '#0D0359' }}>Search Results ({filteredResults.length} Found)</h3>
                     
                     <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                         <div style={{ fontSize: '12px', color: '#666', background: '#e0e0e0', padding: '4px 8px', borderRadius: '4px' }}>
                             Source: {sourceFile}
                         </div>
                         <select style={styles.select} value={sortBy} onChange={handleSortChange}>
                             <option value="match">Sort by: Best Match</option>
                             <option value="designation">Sort by: Designation (A-Z)</option>
                             <option value="exp_low">Sort by: Experience (Low to High)</option>
                             <option value="exp_high">Sort by: Experience (High to Low)</option>
                         </select>
                     </div>
                </div>

                {/* RESULT REFINEMENT BAR */}
                {searchResults.length > 0 && (
                    <div style={styles.refineBar}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}>
                            <span className="material-icons" style={{ color: '#0FE4BD' }}>tune</span>
                            <span style={styles.refineLabel}>Refine Results:</span>
                        </div>

                        {/* Designation Filter - Multi Select */}
                        <div style={{...styles.refineItem, minWidth: '200px'}}>
                            <span style={styles.refineLabel}>Designation</span>
                            <MultiSelect 
                                options={resDesignations} 
                                selected={resultFilter.designation} 
                                onChange={(val) => setResultFilter({...resultFilter, designation: val})} 
                                placeholder="All Designations"
                            />
                        </div>

                        {/* Location Filter */}
                        <div style={styles.refineItem}>
                            <span style={styles.refineLabel}>Location</span>
                            <select 
                                style={styles.refineSelect} 
                                value={resultFilter.location} 
                                onChange={(e) => setResultFilter({...resultFilter, location: e.target.value})}
                            >
                                <option value="">All</option>
                                {resLocations.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        
                        {/* Experience Filter */}
                        <div style={styles.refineItem}>
                            <span style={styles.refineLabel}>Exp Range</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <input 
                                    type="number" 
                                    placeholder="Min" 
                                    style={styles.refineInput}
                                    value={resultFilter.minExp}
                                    onChange={(e) => setResultFilter({...resultFilter, minExp: e.target.value === '' ? '' : Number(e.target.value)})}
                                />
                                <input 
                                    type="number" 
                                    placeholder="Max" 
                                    style={styles.refineInput}
                                    value={resultFilter.maxExp}
                                    onChange={(e) => setResultFilter({...resultFilter, maxExp: e.target.value === '' ? '' : Number(e.target.value)})}
                                />
                            </div>
                        </div>

                        <button 
                            style={{ ...styles.textButtonDark, fontSize: '12px', marginLeft: 'auto' }} 
                            onClick={() => setResultFilter({ designation: [], location: '', minExp: '', maxExp: '' })}
                        >
                            Reset
                        </button>
                    </div>
                )}

                {filteredResults.map(emp => (
                    <div key={emp.id} style={styles.card}>
                        <div style={styles.matchScore} title={emp.scoreTooltip}>
                            {Math.round(emp.score)}%
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                            <h2 style={{ margin: '0 0 4px 0', color: '#333', fontSize: '20px' }}>
                                <span style={{ backgroundColor: '#4169E1', color: 'white', padding: '0 4px' }}>{emp.name}</span>
                            </h2>
                            <div style={{ fontSize: '16px', color: '#555', fontWeight: '500' }}>
                                {emp.designation}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <div style={styles.cardLabel}>
                                    <span className="material-icons" style={styles.cardIcon}>history</span>
                                    TOTAL EXPERIENCE
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: '600' }}>{emp.totalExperience.toFixed(1)} Yrs</div>
                            </div>
                            <div>
                                <div style={styles.cardLabel}>
                                    <span className="material-icons" style={styles.cardIcon}>place</span>
                                    LOCATION
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: '600' }}>{emp.location}</div>
                            </div>
                            <div>
                                <div style={styles.cardLabel}>
                                    <span className="material-icons" style={styles.cardIcon}>event_available</span>
                                    AVAILABLE
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: '#0D0359' }}>
                                    {emp.availableFrom || 'Immediate'}
                                </div>
                            </div>
                            <div>
                                <div style={styles.cardLabel}>
                                    <span className="material-icons" style={styles.cardIcon}>supervisor_account</span>
                                    WFM
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: '600' }}>
                                    {emp.wfmManager || 'N/A'}
                                </div>
                            </div>
                        </div>

                        {/* SKILLS SECTION */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Primary */}
                            <div>
                                <div style={styles.cardLabel}>PRIMARY SKILLS</div>
                                <div>
                                    {emp.primarySkill.map((s, i) => (
                                        <span key={i} style={{ ...styles.tag, ...styles.tagPrimary }}>{s}</span>
                                    ))}
                                    {emp.primarySkill.length === 0 && <span style={{ color: '#aaa', fontSize: '13px' }}>None listed</span>}
                                </div>
                            </div>

                            {/* Secondary */}
                            <div>
                                <div style={styles.cardLabel}>SECONDARY SKILLS</div>
                                <div>
                                    {emp.secondarySkill.map((s, i) => (
                                        <span key={i} style={styles.tag}>{s}</span>
                                    ))}
                                    {emp.secondarySkill.length === 0 && <span style={{ color: '#aaa', fontSize: '13px' }}>None listed</span>}
                                </div>
                            </div>
                        </div>
                        
                        {/* Additional Skills */}
                        {emp.additionalSkill.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                                <div style={styles.cardLabel}>ADDITIONAL SKILLS</div>
                                <div>
                                    {emp.additionalSkill.map((s, i) => (
                                        <span key={i} style={{...styles.tag, backgroundColor: '#f9f9f9'}}>{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                    </div>
                ))}
                
                {filteredResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '8px', color: '#666' }}>
                        No candidates found matching your specific refinement criteria.
                    </div>
                )}
             </div>
        )}
      </main>
      
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);