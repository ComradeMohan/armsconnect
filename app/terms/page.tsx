import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="legal-wrapper">
      <div className="legal-container">
        <div className="legal-card">
          <div className="legal-header">
            <Link href="/" className="back-link">
              <i className="fas fa-arrow-left"></i>
              <span>Back to Home</span>
            </Link>
            <h1>Terms and Conditions</h1>
            <p className="last-updated">Last Updated: January 2025</p>
          </div>

          <div className="legal-content">
            <section>
              <h2>1. Introduction</h2>
              <p>
                Welcome to ARMSConnect, a student portal interface designed to provide enhanced access to academic information. 
                By using this application, you agree to comply with and be bound by the following terms and conditions.
              </p>
            </section>

            <section>
              <h2>2. Educational and Personal Use Only</h2>
              <p>
                This application is intended solely for educational and personal use by students of Saveetha Engineering College. 
                The application serves as a convenient interface to access your own academic information from the official ARMS portal.
              </p>
            </section>

            <section>
              <h2>3. Third-Party Application</h2>
              <p>
                ARMSConnect is an independent, third-party application and is not officially affiliated with, endorsed by, 
                or connected to Saveetha Engineering College or its official ARMS portal. All data displayed is sourced from 
                the official college portal through legitimate user authentication.
              </p>
            </section>

            <section>
              <h2>4. User Responsibilities</h2>
              <p>By using this application, you agree to:</p>
              <ul>
                <li>Use only your own legitimate credentials to access the portal</li>
                <li>Not attempt to access another student's information</li>
                <li>Not use the application for any unauthorized or malicious purposes</li>
                <li>Comply with all college policies and regulations</li>
                <li>Take full responsibility for the security of your credentials</li>
              </ul>
            </section>

            <section>
              <h2>5. Data Handling</h2>
              <p>
                This application does not permanently store your personal data. Academic information is retrieved in real-time 
                from the official portal and displayed for your convenience. Temporary logs may be maintained for debugging 
                and service improvement purposes, but these do not contain sensitive personal information.
              </p>
            </section>

            <section>
              <h2>6. Accuracy of Information</h2>
              <p>
                While we strive to display accurate information, ARMSConnect cannot guarantee the completeness or accuracy 
                of data retrieved from the official portal. For official records, always refer to the original ARMS portal 
                or college administration.
              </p>
            </section>

            <section>
              <h2>7. Rate Limiting and Fair Use</h2>
              <p>
                To ensure fair usage and maintain service stability for all users, the following rate limits apply:
              </p>
              <ul>
                <li><strong>Login Attempts:</strong> 5 login attempts per 15 minutes per IP address</li>
                <li><strong>Failed Login Lockout:</strong> 3 consecutive failed attempts trigger a 5-minute lockout; 10 failed attempts trigger a 1-hour lockout</li>
                <li><strong>Burst Requests:</strong> 10 requests per 30 seconds per user</li>
                <li><strong>Steady Requests:</strong> 30 requests per minute per user</li>
                <li><strong>Daily Requests:</strong> 500 requests per day per user</li>
                <li><strong>IP-based Limits:</strong> 100 requests per minute per IP address</li>
                <li><strong>Concurrent Requests:</strong> Maximum 3 concurrent requests per user, 5 per IP address</li>
              </ul>
              <p>
                These limits are designed to prevent abuse while allowing normal usage patterns. Exceeding these limits may 
                result in temporary restrictions or service suspension.
              </p>
            </section>

            <section>
              <h2>8. Service Availability</h2>
              <p>
                This application depends on the availability and functionality of the official ARMS portal. We cannot guarantee 
                uninterrupted service and are not responsible for disruptions caused by issues with the official portal.
              </p>
            </section>

            <section>
              <h2>9. Limitation of Liability</h2>
              <p>
                ARMSConnect is provided "as is" without any warranties, express or implied. The developers shall not be liable 
                for any direct, indirect, incidental, or consequential damages arising from the use or inability to use this 
                application.
              </p>
            </section>

            <section>
              <h2>10. Modifications to Terms</h2>
              <p>
                We reserve the right to modify these terms and conditions at any time. Continued use of the application after 
                such modifications constitutes your acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2>11. Contact</h2>
              <p>
                If you have questions about these terms and conditions, please contact us through the appropriate channels 
                provided in the application.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
