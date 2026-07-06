import Link from "next/link";

export default function WarningsPage() {
  return (
    <div className="legal-wrapper">
      <div className="legal-container">
        <div className="legal-card">
          <div className="legal-header">
            <Link href="/" className="back-link">
              <i className="fas fa-arrow-left"></i>
              <span>Back to Home</span>
            </Link>
            <h1>Warning Instructions & Disclaimers</h1>
            <p className="last-updated">Last Updated: January 2025</p>
          </div>

          <div className="legal-content">
            <section className="warning-section">
              <h2>⚠️ Important Warnings</h2>
              <div className="warning-box">
                <h3>Use at Your Own Risk</h3>
                <p>
                  This application is provided for convenience only. By using ARMSConnect, you acknowledge that you 
                  understand and accept all risks associated with its use.
                </p>
              </div>
            </section>

            <section>
              <h2>1. Credential Security</h2>
              <div className="warning-item">
                <i className="fas fa-shield-alt"></i>
                <div>
                  <h3>Protect Your Credentials</h3>
                  <p>
                    Never share your ARMS portal credentials with anyone. Your registration number and password are 
                    your personal keys to accessing official college records. Treat them with the same care as your 
                    bank credentials.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-laptop"></i>
                <div>
                  <h3>Secure Devices Only</h3>
                  <p>
                    Avoid using this application on public or shared devices. If you must use a shared device, ensure 
                    you log out completely and clear all browser data after your session.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-key"></i>
                <div>
                  <h3>Strong Passwords</h3>
                  <p>
                    Use a strong, unique password for your ARMS portal account. Avoid using the same password across 
                    multiple services.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>2. Data Accuracy Disclaimer</h2>
              <div className="warning-item">
                <i className="fas fa-exclamation-triangle"></i>
                <div>
                  <h3>Not Official Records</h3>
                  <p>
                    The information displayed in this application is retrieved from the official ARMS portal and may not 
                    always reflect the most current or accurate data. For official purposes, always verify information 
                    directly through the official portal or college administration.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-sync"></i>
                <div>
                  <h3>Real-Time Limitations</h3>
                  <p>
                    Data refresh rates may vary. Recent changes made on the official portal may not immediately reflect 
                    in this application due to caching or synchronization delays.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>3. Usage Guidelines</h2>
              <div className="warning-item">
                <i className="fas fa-user-check"></i>
                <div>
                  <h3>Personal Use Only</h3>
                  <p>
                    Use this application only to access your own academic information. Attempting to access another 
                    student's data is a violation of college policies and may have serious consequences.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-ban"></i>
                <div>
                  <h3>No Unauthorized Access</h3>
                  <p>
                    Do not attempt to bypass security measures, exploit vulnerabilities, or use this application for 
                    any unauthorized purposes. Such actions are strictly prohibited.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-graduation-cap"></i>
                <div>
                  <h3>College Policies Apply</h3>
                  <p>
                    All college policies regarding computer usage, academic integrity, and student conduct apply to 
                    your use of this application. Violations may result in disciplinary action.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>4. Service Availability</h2>
              <div className="warning-item">
                <i className="fas fa-server"></i>
                <div>
                  <h3>Dependency on Official Portal</h3>
                  <p>
                    This application depends entirely on the availability and proper functioning of the official ARMS 
                    portal. We cannot guarantee service availability and are not responsible for outages or issues 
                    originating from the official portal.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-tools"></i>
                <div>
                  <h3>Maintenance Disruptions</h3>
                  <p>
                    Scheduled or unscheduled maintenance of either this application or the official portal may result 
                    in temporary service disruptions. We appreciate your understanding during such periods.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>5. No Warranty Disclaimer</h2>
              <div className="warning-item">
                <i className="fas fa-file-contract"></i>
                <div>
                  <h3>As-Is Basis</h3>
                  <p>
                    This application is provided "as is" without any warranties, express or implied. We do not guarantee 
                    that the application will be error-free, uninterrupted, or meet your specific requirements.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-hand-holding-heart"></i>
                <div>
                  <h3>No Liability</h3>
                  <p>
                    The developers shall not be liable for any damages arising from the use or inability to use this 
                    application, including but not limited to direct, indirect, incidental, or consequential damages.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>6. Data Privacy Notice</h2>
              <div className="warning-item">
                <i className="fas fa-database"></i>
                <div>
                  <h3>No Permanent Storage</h3>
                  <p>
                    Your academic data is not permanently stored on our servers. Information is retrieved in real-time 
                    from the official portal for display purposes only. Temporary logs may be maintained for debugging 
                    but do not contain sensitive personal information.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-cookie"></i>
                <div>
                  <h3>Browser Storage</h3>
                  <p>
                    Session data may be stored in your browser for convenience. You can clear this data at any time 
                    through your browser settings or by using the logout feature.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>7. Academic Integrity</h2>
              <div className="warning-item">
                <i className="fas fa-balance-scale"></i>
                <div>
                  <h3>Honest Use</h3>
                  <p>
                    Use this application as a tool to monitor and understand your academic progress. Do not attempt to 
                    manipulate, falsify, or misrepresent any academic data.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-school"></i>
                <div>
                  <h3>Official Verification</h3>
                  <p>
                    For any official academic requirements, scholarship applications, or employment verification, always 
                    use documents and records obtained directly from the college administration.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2>8. Rate Limiting Warnings</h2>
              <div className="warning-item">
                <i className="fas fa-tachometer-alt"></i>
                <div>
                  <h3>Request Limits Apply</h3>
                  <p>
                    To ensure fair usage and prevent abuse, rate limits are enforced on all requests. Exceeding these limits 
                    will result in temporary restrictions or service suspension.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-user-lock"></i>
                <div>
                  <h3>Login Attempt Restrictions</h3>
                  <p>
                    Multiple failed login attempts will trigger automatic lockouts: 3 failures = 5-minute lockout, 
                    10 failures = 1-hour lockout. These cannot be bypassed.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-clock"></i>
                <div>
                  <h3>Daily Usage Limits</h3>
                  <p>
                    Each user is limited to 500 requests per day. Plan your usage accordingly. Limits reset at midnight.
                  </p>
                </div>
              </div>
              <div className="warning-item">
                <i className="fas fa-network-wired"></i>
                <div>
                  <h3>IP-Based Monitoring</h3>
                  <p>
                    Requests are monitored per IP address (100 per minute). Shared networks or VPNs may affect your 
                    available quota.
                  </p>
                </div>
              </div>
            </section>

            <section className="warning-section">
              <h2>📞 Need Help?</h2>
              <div className="info-box">
                <p>
                  If you encounter issues with this application or have concerns about your data security, please 
                  discontinue use and contact the college IT support or use the official ARMS portal directly.
                </p>
                <p>
                  For questions specifically about this application, use the contact channels provided within the app.
                </p>
              </div>
            </section>

            <section className="warning-section">
              <h2>✅ Acknowledgment</h2>
              <p>
                By continuing to use ARMSConnect, you acknowledge that you have read, understood, and agree to these 
                warnings and disclaimers. If you do not agree with any of these terms, please discontinue use of this 
                application immediately.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
