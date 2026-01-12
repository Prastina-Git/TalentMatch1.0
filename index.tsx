
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from 'xlsx';

// ==========================================
// CONFIGURATION
// ==========================================

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
  designation: string[]; 
  location: string;
  minExp: number | '';
  maxExp: number | '';
}

interface ScoredEmployee extends Employee {
  score: number;
  rawSkillScore: number; 
  expDeviation: number; 
  matchDetails: string[];
  scoreTooltip: string; 
  displayStatus: string; 
}

// --- Constants & Mappings ---

const LOCATION_MAPPING: Record<string, string[]> = {
    'INDIA': ['india', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'mumbai', 'delhi', 'new delhi', 'gurgaon', 'gurugram', 'noida', 'trivandrum', 'thiruvananthapuram', 'kochi', 'cochin', 'kolkata', 'jaipur', 'indore', 'chandigarh', 'coimbatore', 'ahmedabad'],
    'USA': ['usa', 'united states', 'us', 'new york', 'san francisco', 'chicago', 'boston', 'seattle', 'austin', 'dallas', 'atlanta', 'los angeles', 'denver', 'washington', 'nashville', 'franklin'],
    'CANADA': ['canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'mississauga'],
    'ARMENIA': ['armenia', 'yerevan', 'gyumri', 'vanadzor']
};

const SKILL_EXPANSIONS: Record<string, string[]> = {
  '.net': ['.net', 'dotnet', 'dot net', 'vb.net', 'asp.net', 'asp net', '.net core', '.netcore', '.net framework', 'c#', 'c sharp', '.net with add ons', 'net'],
  'java': ['java', 'java 8', 'java 9', 'java 10', 'java 11', 'java 17', 'core java', 'spring', 'spring boot', 'springboot', 'hibernate', 'j2ee', 'j2se', 'java with add ons', 'jva'],
  'react': ['react', 'react.js', 'reactjs', 'react js', 'reactjsx', 'react-js'],
  'react native': ['react native', 'react-native', 'reactnative', 'reactnativejs'],
  'node.js': ['node.js', 'nodejs', 'node js', 'node'],
  'javascript': ['javascript', 'js', 'ecmascript', 'es6', 'es7', 'es8', 'es9', 'es10'],
  'python': ['python', 'python3', 'python 3', 'django', 'flask', 'tornado', 'pandas', 'pyspark', 'numpy', 'scipy', 'dle python'],
  'sql': ['sql', 'sql server', 'ms sql server', 'mysql', 'postgresql', 'postgres', 'oracle sql', 'oracle plsql', 't-sql', 'msbi', 'ssis', 'ssrs', 'msbi/ssis', 'sql (google big query)', 'etl', 'pentaho', 'snaplogic', 'azure synapse'],
  'dba': ['dba', 'database administrator'],
  'aws': ['aws', 'amazon web services', 'amazon cloud', 'amazon aws'],
  'azure': ['azure', 'microsoft azure', 'azure cloud', 'azure solution architect'],
  'gcp': ['gcp', 'google cloud', 'google cloud platform'],
  'cloud ops': ['cloud ops', 'cloud operations', 'aws', 'azure', 'gcp'],
  'cloud security': ['cloud security', 'aws security', 'azure security', 'gcp security'],
  'devops': ['devops', 'dev ops', 'ci/cd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'jenkins', 'azure devops', 'gitlab ci', 'automation anywhere'],
  'rpa': ['rpa', 'ui path', 'automation anywhere', 'power automate'],
  'data engineering': ['data engineering', 'spark', 'kafka', 'hadoop', 'hadoop big data stack', 'data engineering stack', 'data engineering - spark', 'data engineering - kafka'],
  'etl': ['etl', 'etl testing', 'ssis', 'ssrs', 'pentaho', 'etl with add ons', 'snaplogic'],
  'data science': ['data science', 'python', 'r', 'pandas', 'numpy', 'scipy', 'gen ai'],
  'qa automation': ['qa automation', 'qa automation with add ons', 'selenium', 'cypress'],
  'qa manual': ['qa manual', 'dle qa manual', 'edi testing', 'healthrule'],
  'angular': ['angular', 'angularjs', 'angular.js', 'angular 2', 'angular 4', 'angular 5', 'angular 6', 'ng'],
  'html/css': ['html', 'css', 'html/css'],
  'ux design': ['ux design', 'user experience design', 'user research'],
  'ui design': ['ui design', 'user interface design'],
  'salesforce commerce cloud': ['salesforce commerce cloud'],
  'salesforce health cloud': ['salesforce health cloud'],
  'salesforce service cloud': ['salesforce service cloud'],
  'salesforce marketing cloud': ['salesforce marketing cloud'],
  'salesforce testing': ['salesforce testing'],
  'android': ['android', 'android development', 'java android', 'kotlin'],
  'ios': ['ios', 'swift', 'swiftui', 'objective-c'],
  'project management': ['project management', 'project management(consulting)'],
  'product management': ['product management', 'product management(consulting)'],
  'product owner': ['product owner'],
  'business analyst': ['business analyst', 'business analyst lead', 'lead - business analyst'],
  'senior business analyst': ['senior business analyst'],
  'senior product designer': ['senior product designer'],
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
    if (normEmp === normFilter) return true;
    const cities = LOCATION_MAPPING[filterLoc.toUpperCase()];
    if (cities && cities.includes(normEmp)) return true;
    return false;
};

const getCanonicalSkill = (s: string) => {
    const norm = s.toLowerCase().trim();
    if (norm.startsWith('.net') || norm === 'dotnet' || norm === 'dot net') return '.net';
    return norm;
};

const styles = {
  container: { maxWidth: '1400px', margin: '0 auto', padding: '20px' },
  header: { backgroundColor: '#0D0359', color: 'white', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '8px' },
  logoGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoText: { fontFamily: 'Barlow, sans-serif', fontWeight: '700', fontSize: '28px', letterSpacing: '1px' },
  logoIcon: { position: 'relative' as 'relative', width: '32px', height: '32px' },
  logoBox1: { position: 'absolute' as 'absolute', bottom: 0, left: 0, width: '24px', height: '24px', border: '3px solid white', borderRadius: '4px' },
  logoBox2: { position: 'absolute' as 'absolute', top: 0, right: 0, width: '20px', height: '20px', backgroundColor: '#0FE4BD', borderRadius: '0 6px 0 0' },
  appName: { fontSize: '20px', fontWeight: '300', letterSpacing: '0.5px', borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '16px', marginLeft: '4px' },
  main: { display: 'flex', flexDirection: 'column' as 'column', gap: '24px', marginTop: '24px' },
  splitLayout: { display: 'flex', gap: '24px', flexWrap: 'wrap' as 'wrap', alignItems: 'flex-start' },
  searchPanelWrapper: { flex: '2 1 600px', minWidth: '300px' },
  aiPanelWrapper: { flex: '1 1 350px', minWidth: '300px' },
  searchPanel: { backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: '100%' },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' },
  sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#0D0359', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' },
  label: { display: 'block', fontSize: '14px', fontWeight: '600', color: '#0D0359', marginBottom: '8px' },
  input: { width: '100%', padding: '10px 12px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'Barlow, sans-serif', outline: 'none', transition: 'border-color 0.2s' },
  select: { width: '100%', padding: '10px 12px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px', fontFamily: 'Barlow, sans-serif', backgroundColor: 'white' },
  buttonPrimary: { backgroundColor: '#0FE4BD', color: '#0D0359', border: 'none', padding: '12px 24px', borderRadius: '4px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', minWidth: '150px', transition: 'transform 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  textButtonDark: { backgroundColor: 'transparent', border: 'none', color: '#0D0359', padding: '10px 16px', fontSize: '16px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
  actionRow: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', alignItems: 'center', flexWrap: 'wrap' as 'wrap' },
  card: { backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' as 'column', position: 'relative' as 'relative', transition: 'transform 0.2s' },
  cardLabel: { color:'#888', display:'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '600', marginBottom: '4px', letterSpacing: '0.5px' },
  cardIcon: { fontSize: '16px', color: '#0FE4BD' },
  matchScore: { position: 'absolute' as 'absolute', top: '24px', right: '24px', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', color: '#0D0359', cursor: 'help' },
  tag: { display: 'inline-block', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', marginRight: '6px', marginBottom: '6px', backgroundColor: '#F0F2F5', color: '#555' },
  tagPrimary: { backgroundColor: '#E8E6F5', color: '#0D0359', fontWeight: '500' },
  aiSection: { backgroundColor: '#0D0359', padding: '24px', borderRadius: '12px', color: 'white', boxShadow: '0 4px 12px rgba(13, 3, 89, 0.15)', height: '100%', display: 'flex', flexDirection: 'column' as 'column' },
  aiHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' },
  aiIconBox: { width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0FE4BD' },
  aiTextArea: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', padding: '16px', color: 'white', fontFamily: 'Barlow, sans-serif', fontSize: '16px', minHeight: '100px', resize: 'vertical' as 'vertical', outline: 'none', marginBottom: '16px', flex: 1 },
  aiFooter: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: 'auto' },
  textButtonLight: { background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.8)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap' as 'nowrap', minWidth: '100px' },
  modalOverlay: { position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' },
  modalContent: { backgroundColor: 'white', padding: '32px', borderRadius: '12px', maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto' as 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', position: 'relative' as 'relative' },
  modalClose: { position: 'absolute' as 'absolute', top: '24px', right: '24px', border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', color: '#555' },
  refineBar: { display: 'flex', flexWrap: 'wrap' as 'wrap', gap: '12px', padding: '16px', backgroundColor: '#fff', borderRadius: '8px', marginBottom: '16px', border: '1px solid #eee', alignItems: 'center' },
  refineItem: { display: 'flex', flexDirection: 'column' as 'column', gap: '4px', minWidth: '140px', flex: '1 1 140px' },
  refineLabel: { fontSize: '12px', fontWeight: 600, color: '#0D0359', textTransform: 'uppercase' as 'uppercase' },
  refineSelect: { padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'Barlow, sans-serif' },
  refineInput: { padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'Barlow, sans-serif', width: '100%' },
  content: { marginTop: '16px', display: 'flex', flexDirection: 'column' as 'column', gap: '16px' }
};

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

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  const toggleOption = (option: string) => {
    if (selected.includes(option)) { onChange(selected.filter(s => s !== option)); } else { onChange([...selected, option]); }
  };
  const removeTag = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(s => s !== tag));
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ ...styles.select, minHeight: '42px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', cursor: 'pointer' }} onClick={() => setIsOpen(!isOpen)}>
        {selected.length === 0 && <span style={{ color: '#aaa' }}>{placeholder}</span>}
        {selected.map(tag => (
          <span key={tag} style={{ backgroundColor: '#E8E6F5', color: '#0D0359', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {tag} <span onClick={(e) => removeTag(tag, e)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>▼</span>
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '250px', overflowY: 'auto', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px', zIndex: 1000, marginTop: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ ...styles.input, padding: '6px' }} onClick={(e) => e.stopPropagation()} />
          </div>
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <div key={opt} onClick={() => toggleOption(opt)} style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: selected.includes(opt) ? '#F0F7FF' : 'white', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={selected.includes(opt)} readOnly style={{ pointerEvents: 'none' }} /> {opt}
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

const HelpModal = ({ onClose }: { onClose: () => void }) => {
    return (
        <div style={styles.modalOverlay} onClick={onClose}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <button style={styles.modalClose} onClick={onClose}>×</button>
                <h2 style={{ color: '#0D0359', marginTop: 0 }}>Talent Match - Documentation</h2>
                <h3 style={{ color: '#0FE4BD' }}>1. Use Case Overview</h3>
                <p><strong>Talent Match</strong> is an intelligent resource management tool designed to optimize the utilization of the "Launchpad" (Bench).</p>
                <h3 style={{ color: '#0FE4BD' }}>2. Key Functionality</h3>
                <ul>
                    <li><strong>Skills Search:</strong> Results only show if a skill matches (Exact or via Expansion).</li>
                    <li><strong>Scoring Hierarchy:</strong> Primary Exact > Secondary Exact > Additional Exact > Primary Expansion > Secondary Expansion > Additional Expansion.</li>
                    <li><strong>Experience Range:</strong> Filter candidates by a minimum and maximum years of experience.</li>
                    <li><strong>Location Intelligence:</strong> Smart mapping of cities.</li>
                </ul>
                <h3 style={{ color: '#0FE4BD' }}>3. Business Rules</h3>
                <ul>
                    <li><strong>Exclusions:</strong> Automatically hides employees marked as "Earmarked" or "Going on ML".</li>
                    <li><strong>Requirement:</strong> Results are only displayed if at least one selected/searched skill matches.</li>
                </ul>
            </div>
        </div>
    );
};

const App = () => {
  const [data, setData] = useState<Employee[]>([]);
  const [uniqueSkills, setUniqueSkills] = useState<string[]>([]);
  const [uniqueDesignations, setUniqueDesignations] = useState<string[]>([]);
  const [uniqueLocations, setUniqueLocations] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<FilterState>({ skills: [], minExperience: '', maxExperience: '', location: '', projectStartDate: '' });
  const [searchResults, setSearchResults] = useState<ScoredEmployee[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('match');
  const [showHelp, setShowHelp] = useState(false);
  const [sourceFile, setSourceFile] = useState<string>('Not Loaded');
  const [resultFilter, setResultFilter] = useState<ResultFilterState>({ designation: [], location: '', minExp: '', maxExp: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDefaultData(); }, []);

  const loadDefaultData = async () => {
    try {
        setLoading(true);
        const fileName = 'Launchpad Joined_Yet to join.xlsx';
        const response = await fetch(`./${fileName}?t=${new Date().getTime()}`);
        if (!response.ok) { setLoading(false); return; }
        const blob = await response.blob();
        const file = new File([blob], fileName);
        await processData(file);
    } catch (error) { console.error("Error loading default data:", error); } finally { setLoading(false); }
  };

  const processData = async (file: File) => {
    setLoading(true);
    setSourceFile(file.name);
    setSearchResults([]);
    setHasSearched(false);
    setFilters({ skills: [], minExperience: '', maxExperience: '', location: '', projectStartDate: '' });
    setResultFilter({ designation: [], location: '', minExp: '', maxExp: '' });
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArr, { type: 'array', cellDates: true });
        const targetSheetName = "Launchpad_Joined_Yet to join";
        const foundSheetName = workbook.SheetNames.find(n => n.toLowerCase() === targetSheetName.toLowerCase()) || workbook.SheetNames[0];
        const sheet = workbook.Sheets[foundSheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        const findColumnValue = (row: any, ...possibleNames: string[]) => {
            for (const name of possibleNames) {
                if (row[name] !== undefined) return row[name];
                const key = Object.keys(row).find(k => k.toLowerCase().replace(/\s+/g, '') === name.toLowerCase().replace(/\s+/g, ''));
                if (key !== undefined) return row[key];
            }
            return undefined;
        };
        const employees: Employee[] = jsonData.map((row: any, index: number) => {
           const empName = findColumnValue(row, 'Employee Name', 'Name') || 'Unknown';
           const empId = findColumnValue(row, 'Employee ID', 'ID') || `EMP-${index}`;
           const cleanStr = (val: any) => typeof val === 'string' ? val.trim() : (val ? String(val).trim() : '');
           const pSkill = cleanStr(findColumnValue(row, 'Primary Skill'));
           const sSkill = cleanStr(findColumnValue(row, 'Secondary Skill', 'Secondary'));
           const aSkill = cleanStr(findColumnValue(row, 'Additional Skill', 'Additional Skills'));
           const pSkills = pSkill ? pSkill.split(',').map((s: string) => s.trim()) : [];
           const sSkills = sSkill ? sSkill.split(',').map((s: string) => s.trim()) : [];
           const aSkills = aSkill ? aSkill.split(',').map((s: string) => s.trim()) : [];
           const expVal = findColumnValue(row, 'Total experience (Yrs)', 'Total Experience', 'Exp');
           const exp = typeof expVal === 'number' ? expVal : parseFloat(expVal) || 0;
           const assignDateRaw = findColumnValue(row, 'Assign Date');
           let assignDate: Date | null = null;
           if (assignDateRaw instanceof Date) assignDate = assignDateRaw;
           else if (assignDateRaw) assignDate = new Date(assignDateRaw);
           return { id: String(empId), name: cleanStr(empName), primarySkill: pSkills, secondarySkill: sSkills, additionalSkill: aSkills, totalExperience: exp, designation: cleanStr(findColumnValue(row, 'Designation')), location: cleanStr(findColumnValue(row, 'Location')), joiningStatus: cleanStr(findColumnValue(row, 'Joining Status')), assignDate: assignDate, deploymentStatus: cleanStr(findColumnValue(row, 'Deployment Status')), deploymentStatus1: cleanStr(findColumnValue(row, 'Deployment Status 1')), availableFrom: cleanStr(findColumnValue(row, 'Available From')), wfmManager: cleanStr(findColumnValue(row, 'New WFM Manager', 'WFM Manager')), originalRow: row };
        });
        const filteredEmployees = employees.filter(emp => {
            const d1 = (emp.deploymentStatus1 || '').toLowerCase();
            const d = (emp.deploymentStatus || '').toLowerCase();
            if (d1 === 'earmarked') return false;
            if (d === 'going on ml') return false;
            return true;
        });
        setData(filteredEmployees);
        const skillsSet = new Set<string>();
        const desSet = new Set<string>();
        const locSet = new Set<string>();
        filteredEmployees.forEach(emp => {
            [...emp.primarySkill, ...emp.secondarySkill, ...emp.additionalSkill].forEach(s => { if(s) skillsSet.add(s); });
            if (emp.designation) desSet.add(emp.designation);
            if (emp.location) locSet.add(emp.location);
        });
        setUniqueSkills(Array.from(skillsSet).sort());
        setUniqueDesignations(Array.from(desSet).sort());
        setUniqueLocations(Array.from(locSet).sort());
        setLoading(false);
      } catch (error) { console.error("Error parsing excel:", error); setLoading(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { processData(e.target.files[0]); } };
  const handleClearAll = () => { setFilters({ skills: [], minExperience: '', maxExperience: '', location: '', projectStartDate: '' }); setAiQuery(''); setSearchResults([]); setHasSearched(false); setResultFilter({ designation: [], location: '', minExp: '', maxExp: '' }); };
  
  const handleAIQuery = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) { alert("API Key is missing."); return; }
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Extract filters from: "${aiQuery}". Skills: ${uniqueSkills.join(', ')}. Locations: ${uniqueLocations.join(', ')}. Return JSON: {skills, minExperience, maxExperience, location, projectStartDate}. Rules: Map cities to countries. Use null for missing.`;
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: prompt, 
        config: { responseMimeType: 'application/json' } 
      });
      const extracted = JSON.parse(response.text || "{}");
      const newFilters = { ...filters };
      if (extracted.skills && Array.isArray(extracted.skills)) newFilters.skills = extracted.skills;
      if (extracted.location) newFilters.location = extracted.location;
      if (extracted.minExperience) newFilters.minExperience = extracted.minExperience;
      if (extracted.maxExperience) newFilters.maxExperience = extracted.maxExperience;
      if (extracted.projectStartDate) newFilters.projectStartDate = extracted.projectStartDate;
      setFilters(newFilters);
      handleSearch(newFilters);
    } catch (error) { console.error("AI Error:", error); } finally { setIsAiLoading(false); }
  };

  const calculateScore = (emp: Employee, currentFilters: FilterState): ScoredEmployee | null => {
    let skillScore = 0;
    let expScore = 0;
    let availScore = 0;
    const matchedDetails: string[] = [];
    const requestedSkills = currentFilters.skills;
    const hasSkillFilters = requestedSkills.length > 0;
    
    // REQUIREMENT: Results should be displayed only if one of the skillset matches with the skill expansion list.
    if (!hasSkillFilters) return null;

    let totalSkillWeight = 0;
    let anySkillMatch = false;

    requestedSkills.forEach(reqSkill => {
        const canonicalReq = getCanonicalSkill(reqSkill);
        const expansions = SKILL_EXPANSIONS[canonicalReq] || [canonicalReq];

        let bestMatchForThisSkill = 0;

        // Check Primary
        emp.primarySkill.forEach(s => {
            const normS = getCanonicalSkill(s);
            if (normS === canonicalReq) { bestMatchForThisSkill = Math.max(bestMatchForThisSkill, 50); anySkillMatch = true; matchedDetails.push(`Primary Exact: ${s}`); }
            else if (expansions.some(e => normS === getCanonicalSkill(e) || (e.length > 3 && normS.includes(getCanonicalSkill(e))))) {
                bestMatchForThisSkill = Math.max(bestMatchForThisSkill, 25); anySkillMatch = true; matchedDetails.push(`Primary Expansion: ${s}`);
            }
        });

        // Check Secondary
        emp.secondarySkill.forEach(s => {
            const normS = getCanonicalSkill(s);
            if (normS === canonicalReq) { bestMatchForThisSkill = Math.max(bestMatchForThisSkill, 40); anySkillMatch = true; matchedDetails.push(`Secondary Exact: ${s}`); }
            else if (expansions.some(e => normS === getCanonicalSkill(e) || (e.length > 3 && normS.includes(getCanonicalSkill(e))))) {
                bestMatchForThisSkill = Math.max(bestMatchForThisSkill, 15); anySkillMatch = true; matchedDetails.push(`Secondary Expansion: ${s}`);
            }
        });

        // Check Additional
        emp.additionalSkill.forEach(s => {
            const normS = getCanonicalSkill(s);
            if (normS === canonicalReq) { bestMatchForThisSkill = Math.max(bestMatchForThisSkill, 30); anySkillMatch = true; matchedDetails.push(`Additional Exact: ${s}`); }
            else if (expansions.some(e => normS === getCanonicalSkill(e) || (e.length > 3 && normS.includes(getCanonicalSkill(e))))) {
                bestMatchForThisSkill = Math.max(bestMatchForThisSkill, 10); anySkillMatch = true; matchedDetails.push(`Additional Expansion: ${s}`);
            }
        });

        totalSkillWeight += bestMatchForThisSkill;
    });

    if (!anySkillMatch) return null;
    
    skillScore = Math.min(50, totalSkillWeight / requestedSkills.length);

    let expDeviation = 0;
    if (currentFilters.minExperience !== '' || currentFilters.maxExperience !== '') {
        const min = currentFilters.minExperience === '' ? 0 : Number(currentFilters.minExperience);
        const max = currentFilters.maxExperience === '' ? 100 : Number(currentFilters.maxExperience);
        if (emp.totalExperience < min || emp.totalExperience > max) return null;
        expScore = 30; 
        const target = (min + max) / 2;
        expDeviation = Math.abs(emp.totalExperience - target);
    } else {
        expScore = 30; 
    }

    let status = 'Unknown';
    if (emp.joiningStatus?.toLowerCase() === 'joined') status = 'Joined';
    else if (emp.availableFrom?.toLowerCase().includes('immediate')) status = 'Immediate';
    else if (emp.joiningStatus?.toLowerCase() === 'ytr') status = 'YTR';

    if (status === 'Joined' || status === 'Immediate') { availScore = 20; }
    else if (status === 'YTR') {
        if (currentFilters.projectStartDate && emp.assignDate) {
             const projDate = new Date(currentFilters.projectStartDate);
             if (emp.assignDate <= projDate) { availScore = 15; status = 'YTR (Available)'; }
             else { availScore = 5; status = 'YTR (Late)'; }
        } else { availScore = 15; status = 'YTR'; }
    }

    const totalScore = skillScore + expScore + availScore;
    const tooltip = `Skills: ${skillScore.toFixed(1)}/50\nExperience: ${expScore.toFixed(1)}/30\nAvailability: ${availScore.toFixed(1)}/20`;

    return { ...emp, score: totalScore, rawSkillScore: skillScore, expDeviation: expDeviation, matchDetails: matchedDetails, scoreTooltip: tooltip, displayStatus: status };
  };

  const handleSearch = (filtersOverride?: FilterState) => {
    const activeFilters = filtersOverride || filters;
    if (activeFilters.skills.length === 0) {
        alert("Please select at least one skill to search.");
        return;
    }
    setHasSearched(true);
    let results = data.map(emp => calculateScore(emp, activeFilters)).filter((emp): emp is ScoredEmployee => emp !== null);
    results = results.filter(emp => {
        if (activeFilters.location && !isLocationMatch(emp.location, activeFilters.location)) return false;
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
          if (Math.abs(b.rawSkillScore - a.rawSkillScore) > 0.1) return b.rawSkillScore - a.rawSkillScore;
          return b.score - a.score;
      });
      setSearchResults(sorted);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => { const val = e.target.value; setSortBy(val); sortResults(searchResults, val); };
  const filteredResults = useMemo(() => {
      return searchResults.filter(emp => {
          if (resultFilter.designation.length > 0 && !resultFilter.designation.includes(emp.designation)) return false;
          if (resultFilter.location && emp.location !== resultFilter.location) return false;
          if (resultFilter.minExp !== '' && emp.totalExperience < Number(resultFilter.minExp)) return false;
          if (resultFilter.maxExp !== '' && emp.totalExperience > Number(resultFilter.maxExp)) return false;
          return true;
      });
  }, [searchResults, resultFilter]);

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
      <header style={styles.header}>
        <div style={styles.logoGroup}>
           <div style={styles.logoIcon}> <div style={styles.logoBox1}></div> <div style={styles.logoBox2}></div> </div>
           <span style={styles.logoText}>EMIDS</span> <span style={styles.appName}>Talent Match</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => fileInputRef.current?.click()}>
                <span className="material-icons">upload_file</span> <span style={{fontSize: '14px', fontWeight: 500}}>Upload</span>
            </button>
            <button style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowHelp(true)}>
                <span className="material-icons">help_outline</span> Help
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".xlsx" />
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.splitLayout}>
            <div style={styles.searchPanelWrapper}>
                <div style={styles.searchPanel}>
                    <div style={styles.sectionTitle}> <span className="material-icons">filter_list</span> Filter Candidates </div>
                    <div style={styles.filterGrid}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label style={styles.label}>SKILLS (REQUIRED)</label>
                            <MultiSelect options={uniqueSkills} selected={filters.skills} onChange={(val) => setFilters({...filters, skills: val})} placeholder="Select Skills to Match" />
                        </div>
                        <div>
                            <label style={styles.label}>YEARS OF EXPERIENCE</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input type="number" placeholder="Min" min="0" style={styles.input} value={filters.minExperience} onChange={(e) => setFilters({...filters, minExperience: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))})} />
                                <span style={{ color: '#888' }}>-</span>
                                <input type="number" placeholder="Max" min="0" style={styles.input} value={filters.maxExperience} onChange={(e) => setFilters({...filters, maxExperience: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))})} />
                            </div>
                        </div>
                        <div>
                            <label style={styles.label}>LOCATION</label>
                            <select style={styles.select} value={filters.location} onChange={(e) => setFilters({...filters, location: e.target.value})}>
                                <option value="">Any Location</option>
                                {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={styles.label}>EXPECTED START DATE</label>
                            <input type="date" style={styles.input} min={new Date().toISOString().split('T')[0]} value={filters.projectStartDate} onChange={(e) => setFilters({...filters, projectStartDate: e.target.value})} />
                        </div>
                    </div>
                    <div style={styles.actionRow}>
                        <button style={styles.textButtonDark} onClick={handleClearAll}> <span className="material-icons" style={{ fontSize: '18px' }}>close</span> Clear Filters </button>
                        <button style={styles.buttonPrimary} onClick={() => handleSearch()}> <span className="material-icons">search</span> Search Candidates </button>
                    </div>
                </div>
            </div>
            <div style={styles.aiPanelWrapper}>
                <div style={styles.aiSection}>
                    <div style={styles.aiHeader}>
                        <div style={styles.aiIconBox}> <span className="material-icons" style={{ fontSize: '24px' }}>auto_awesome</span> </div>
                        <div> <div style={{ fontWeight: 'bold', fontSize: '18px' }}>AI Assistant</div> <div style={{ fontSize: '12px', opacity: 0.8 }}>Natural Language Search</div> </div>
                    </div>
                    <textarea style={styles.aiTextArea} placeholder="e.g., Show me senior java developers" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} />
                    <div style={styles.aiFooter}>
                        <button style={styles.textButtonLight} onClick={handleClearAll}> <span className="material-icons" style={{ fontSize: '16px' }}>backspace</span> Clear Input </button>
                        <button style={{ ...styles.buttonPrimary, padding: '10px 16px', minWidth: '130px', fontSize: '14px' }} onClick={handleAIQuery} disabled={isAiLoading}>
                            <span className="material-icons" style={{ fontSize: '18px' }}>search</span> {isAiLoading ? 'Thinking...' : 'Find Talent'}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {hasSearched && (
             <div style={styles.content}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <h3 style={{ margin: 0, color: '#0D0359' }}>Match Results ({filteredResults.length} Found)</h3>
                     <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                         <div style={{ fontSize: '12px', color: '#666', background: '#e0e0e0', padding: '4px 8px', borderRadius: '4px' }}> Source: {sourceFile} </div>
                         <select style={styles.select} value={sortBy} onChange={handleSortChange}>
                             <option value="match">Sort by: Best Match</option>
                             <option value="designation">Sort by: Designation (A-Z)</option>
                             <option value="exp_low">Sort by: Experience (Low to High)</option>
                             <option value="exp_high">Sort by: Experience (High to Low)</option>
                         </select>
                     </div>
                </div>

                <div style={styles.refineBar}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}> <span className="material-icons" style={{ color: '#0FE4BD' }}>tune</span> <span style={styles.refineLabel}>Refine Results:</span> </div>
                    <div style={{...styles.refineItem, minWidth: '200px'}}>
                        <span style={styles.refineLabel}>Designation</span>
                        <MultiSelect options={resDesignations} selected={resultFilter.designation} onChange={(val) => setResultFilter({...resultFilter, designation: val})} placeholder="All Designations" />
                    </div>
                    <div style={styles.refineItem}>
                        <span style={styles.refineLabel}>Location</span>
                        <select style={styles.refineSelect} value={resultFilter.location} onChange={(e) => setResultFilter({...resultFilter, location: e.target.value})}>
                            <option value="">All</option>
                            {resLocations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div style={styles.refineItem}>
                        <span style={styles.refineLabel}>Exp Range</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <input type="number" placeholder="Min" style={styles.refineInput} value={resultFilter.minExp} onChange={(e) => setResultFilter({...resultFilter, minExp: e.target.value === '' ? '' : Number(e.target.value)})} />
                            <input type="number" placeholder="Max" style={styles.refineInput} value={resultFilter.maxExp} onChange={(e) => setResultFilter({...resultFilter, maxExp: e.target.value === '' ? '' : Number(e.target.value)})} />
                        </div>
                    </div>
                    <button style={{ ...styles.textButtonDark, fontSize: '12px', marginLeft: 'auto' }} onClick={() => setResultFilter({ designation: [], location: '', minExp: '', maxExp: '' })}> Reset </button>
                </div>

                {filteredResults.map(emp => (
                    <div key={emp.id} style={styles.card}>
                        <div style={styles.matchScore} title={emp.scoreTooltip}> {Math.round(emp.score)}% </div>
                        <div style={{ marginBottom: '16px' }}>
                            <h2 style={{ margin: '0 0 4px 0', color: '#333', fontSize: '20px' }}> <span style={{ backgroundColor: '#4169E1', color: 'white', padding: '0 4px' }}>{emp.name}</span> </h2>
                            <div style={{ fontSize: '16px', color: '#555', fontWeight: '500' }}> {emp.designation} </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
                            <div> <div style={styles.cardLabel}><span className="material-icons" style={styles.cardIcon}>history</span>EXP</div> <div style={{ fontSize: '16px', fontWeight: '600' }}>{emp.totalExperience.toFixed(1)} Yrs</div> </div>
                            <div> <div style={styles.cardLabel}><span className="material-icons" style={styles.cardIcon}>place</span>LOC</div> <div style={{ fontSize: '16px', fontWeight: '600' }}>{emp.location}</div> </div>
                            <div> <div style={styles.cardLabel}><span className="material-icons" style={styles.cardIcon}>event_available</span>AVAIL</div> <div style={{ fontSize: '16px', fontWeight: '600', color: '#0D0359' }}> {emp.availableFrom || 'Immediate'} </div> </div>
                            <div> <div style={styles.cardLabel}><span className="material-icons" style={styles.cardIcon}>supervisor_account</span>WFM</div> <div style={{ fontSize: '16px', fontWeight: '600' }}> {emp.wfmManager || 'N/A'} </div> </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
                            <div>
                                <div style={styles.cardLabel}>PRIMARY SKILLS</div>
                                <div> {emp.primarySkill.map((s, i) => <span key={i} style={{ ...styles.tag, ...styles.tagPrimary }}>{s}</span>)} </div>
                            </div>
                            <div>
                                <div style={styles.cardLabel}>SECONDARY SKILLS</div>
                                <div> {emp.secondarySkill.map((s, i) => <span key={i} style={styles.tag}>{s}</span>)} </div>
                            </div>
                            <div>
                                <div style={styles.cardLabel}>ADDITIONAL SKILLS</div>
                                <div> {emp.additionalSkill.map((s, i) => <span key={i} style={styles.tag}>{s}</span>)} </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {filteredResults.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '8px', color: '#666' }}> 
                        No candidates found matching the selected skills. Note: Skills are required for results to appear. 
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
