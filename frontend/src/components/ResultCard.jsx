import React from "react";
import {
  Calendar,
  Briefcase,
  Rocket,
  Users,
  TrendingUp,
  BarChart2,
  DollarSign,
  Link2,
  Twitter,
  Facebook,
  Instagram,
  Mail,
  MessageSquare,
  Package,
  Code,
  Building,
  Globe,
  MapPin,
  Award,
  Target
} from "lucide-react";

const SOCIAL_COLORS = {
  linkedin: '#0077b5',
  twitter: '#1da1f2',
  facebook: '#1877f3',
  instagram: 'linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #515bd4 100%)'
};

const ResultCard = ({ result, allKeys, index }) => {
  const displayTitle = result.name && result.name.trim() ? result.name : "Untitled";
  
  // Icon mapping for different field types
  const getFieldIcon = (fieldName) => {
    const iconMap = {
      techstack: { icon: Code, color: "icon-success" },
      website: { icon: Globe, color: "icon-info" },
      email: { icon: Mail, color: "icon-warning" },
      yearFounded: { icon: Calendar, color: "icon-primary" },
      industry: { icon: Building, color: "icon-secondary" },
      projects: { icon: Rocket, color: "icon-success" },
      competitors: { icon: Users, color: "icon-warning" },
      marketPosition: { icon: Target, color: "icon-info" },
      companySize: { icon: BarChart2, color: "icon-primary" },
      fundingStage: { icon: DollarSign, color: "icon-success" },
      marketPerformance: { icon: TrendingUp, color: "icon-warning" },
      linkedin: { icon: Link2, color: "icon-info" },
      twitter: { icon: Twitter, color: "icon-primary" },
      facebook: { icon: Facebook, color: "icon-secondary" },
      instagram: { icon: Instagram, color: "icon-success" },
      address: { icon: MapPin, color: "icon-warning" },
      overview: { icon: Award, color: "icon-info" }
    };
    
    return iconMap[fieldName] || { icon: Link2, color: "icon-primary" };
  };

  const renderField = (fieldName, value, label) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    
    const { icon: Icon, color } = getFieldIcon(fieldName);
    
    return (
      <div className="field-item mb-3" style={{ animationDelay: `${index * 0.05}s` }}>
        <div className="d-flex align-items-start">
          <div className={`icon-wrapper ${color} me-3 mt-1`}>
            <Icon size={16} color="white" />
          </div>
          <div className="flex-grow-1">
            <div className="field-label fw-semibold mb-1" style={{ fontSize: '0.875rem' }}>
              {label}
            </div>
            <div className="field-value">
              {fieldName === 'techstack' && Array.isArray(value) ? (
                <div className="d-flex flex-wrap gap-1">
                  {value.map((tech, i) => (
                    <span 
                      key={i} 
                      className="badge bg-light text-dark me-1 mb-1"
                      style={{ 
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        padding: '4px 8px'
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              ) : fieldName === 'competitors' && Array.isArray(value) ? (
                <div className="d-flex flex-wrap gap-1">
                  {value.map((competitor, i) => (
                    <span 
                      key={i} 
                      className="badge bg-secondary text-white me-1 mb-1"
                      style={{ 
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        padding: '4px 8px'
                      }}
                    >
                      {competitor}
                    </span>
                  ))}
                </div>
              ) : fieldName === 'website' || fieldName === 'linkedin' || fieldName === 'twitter' || fieldName === 'facebook' || fieldName === 'instagram' ? (
                <a 
                  href={value} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-decoration-none"
                  style={{ wordBreak: 'break-all' }}
                >
                  {value}
                </a>
              ) : (
                <span style={{ wordBreak: 'break-word' }}>{value}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="card slide-in-up" 
      style={{ 
        minWidth: 250, 
        maxWidth: 350,
        animationDelay: `${index * 0.1}s`
      }}
    >
      <div className="card-body">
        {/* Enhanced Header */}
        <div className="text-center mb-4">
          <div className="icon-wrapper icon-primary mb-3">
            <Building size={24} color="white" />
          </div>
          <h5 className="card-title mb-0">{displayTitle}</h5>
        </div>
        
        {/* Tagline (if present) */}
        {result.tagline && (
          <div className="mb-3 text-center">
            <span 
              className="badge bg-info text-white tagline-badge-responsive"
              style={{
                fontSize: 'clamp(0.85em, 2.5vw, 1.05em)',
                borderRadius: '8px',
                padding: '6px 14px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-line',
                maxWidth: '90%',
                display: 'inline-block',
                lineHeight: 1.3
              }}
            >
              {result.tagline}
            </span>
          </div>
        )}

        {/* Website (always present) */}
        {result.website && (
          <div className="mb-3 text-center">
            <a href={result.website} target="_blank" rel="noopener noreferrer" className="fw-bold text-primary" style={{ fontSize: '1.05em', wordBreak: 'break-all', textDecoration: 'underline' }}>
              <Globe size={18} className="me-1 mb-1" />
              {result.website}
            </a>
          </div>
        )}

        {/* Fields */}
        <div className="fields-container">
          {renderField('address', result.address, 'Address')}
          {renderField('yearFounded', result.yearFounded, 'Year Founded / Operational Status')}
          {renderField('industry', result.industry, 'Industry / Market Sector')}
          {renderField('projects', result.projects, 'Products / Services / Projects')}
          {renderField('techstack', result.techstack, 'Tech Stack')}
          {renderField('competitors', result.competitors, 'Competitors')}
          {renderField('marketPosition', result.marketPosition, 'Market Position')}
          {renderField('companySize', result.companySize, 'Company Size')}
          {renderField('fundingStage', result.fundingStage, 'Funding Stage')}
          {renderField('marketPerformance', result.marketPerformance, 'Market Performance')}
          {renderField('overview', result.overview, 'Company Overview')}
          
          {/* Social Media Section */}
          {(result.linkedin || result.twitter || result.facebook || result.instagram) && (
            <div className="social-section mt-4 pt-3 border-top">
              <div className="field-label fw-semibold mb-2" style={{ fontSize: '0.875rem' }}>
                Social Media
              </div>
              <div className="d-flex flex-wrap gap-2">
                {result.linkedin && (
                  <a 
                    href={result.linkedin} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-sm d-flex align-items-center"
                    style={{ borderRadius: '8px', background: SOCIAL_COLORS.linkedin, color: '#fff', fontWeight: 700, border: 'none' }}
                  >
                    <Link2 size={16} className="me-1" color="#fff" />
                    <span style={{ color: '#fff' }}>LinkedIn</span>
                  </a>
                )}
                {result.twitter && (
                  <a 
                    href={result.twitter} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-sm d-flex align-items-center"
                    style={{ borderRadius: '8px', background: SOCIAL_COLORS.twitter, color: '#fff', fontWeight: 700, border: 'none' }}
                  >
                    <Twitter size={16} className="me-1" color="#fff" />
                    <span style={{ color: '#fff' }}>Twitter</span>
                  </a>
                )}
                {result.facebook && (
                  <a 
                    href={result.facebook} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-sm d-flex align-items-center"
                    style={{ borderRadius: '8px', background: SOCIAL_COLORS.facebook, color: '#fff', fontWeight: 700, border: 'none' }}
                  >
                    <Facebook size={16} className="me-1" color="#fff" />
                    <span style={{ color: '#fff' }}>Facebook</span>
                  </a>
                )}
                {result.instagram && (
                  <a 
                    href={result.instagram} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-sm d-flex align-items-center"
                    style={{ borderRadius: '8px', background: '#fff', color: '#fff', fontWeight: 700, border: 'none', backgroundImage: SOCIAL_COLORS.instagram, backgroundClip: 'padding-box' }}
                  >
                    <Instagram size={16} className="me-1" color="#fff" />
                    <span style={{ color: '#fff' }}>Instagram</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultCard; 