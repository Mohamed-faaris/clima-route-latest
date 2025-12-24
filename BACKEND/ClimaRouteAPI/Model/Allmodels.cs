namespace ClimaRouteAPI.Models
{
    // 1. AUTH & USERS (For Login & ManageUsers.tsx)
    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
        public string Role { get; set; } // "admin" or "user"
        public string Status { get; set; } // "Active", "On Leave"
        public string Phone { get; set; } // User phone number
        public string VehicleId { get; set; } // Fleet/Vehicle ID assigned to user
        public string PlainPassword { get; set; } // Stored password for display (demo only)
        public DateTime? UpdatedAt { get; set; } // Last update timestamp
    }

    public class LoginRequest 
    { 
        public string Email { get; set; } 
        public string Password { get; set; } 
    }

    // 2. ADMIN DASHBOARD (For AdminDashboard.tsx)
    public class DashboardStats
    {
        public int ActiveFleet { get; set; }
        public int ActiveAlerts { get; set; }
        public int TotalDrivers { get; set; }
        public string SystemHealth { get; set; }
        public List<ChartData> WeeklyVolume { get; set; }
    }
    public class ChartData 
    { 
        public string Name { get; set; } 
        public int Trips { get; set; } 
    }

    // 3. FLEET & MAPS (For FleetLiveMonitor.tsx)
    public class VehiclePosition
    {
        public string Id { get; set; }
        public double Lat { get; set; }
        public double Lon { get; set; }
        public string Status { get; set; } // "Moving", "Idle", "SOS"
        public string Heading { get; set; }
    }

    // 4. ALERTS & SOS (For EmergencyAlerts.tsx & SOS.tsx)
    public class SosAlert
    {
        public string Id { get; set; }
        public string VehicleId { get; set; }
        public string Type { get; set; } // "Medical", "Mechanical", "Theft"
        public string Location { get; set; }
        public string Time { get; set; }
        public bool IsActive { get; set; }
    }

    // 5. UTILITIES (For RestPoint.tsx, Notifications.tsx)
    public class NotificationItem
    {
        public string Id { get; set; }
        public string Category { get; set; } // "Critical", "Route", "System"
        public string Title { get; set; }
        public string Description { get; set; }
        public string Timestamp { get; set; }
        public bool Read { get; set; }
    }

    public class RestPointItem
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Type { get; set; }
        public string Distance { get; set; }
        public string SafetyRating { get; set; }
        public List<string> Facilities { get; set; }
    }

    // 6. OPERATIONS (For AdaptiveSpeed.tsx)
    public class SpeedData
    {
        public string SegmentName { get; set; }
        public int CurrentSpeed { get; set; }
        public int RecommendedSpeed { get; set; }
        public string RiskLevel { get; set; }
    }
}