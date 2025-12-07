import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import PatientForm from './PatientForm';
import DailyView from './DailyView';
import MonthlyStatistics from './MonthlyStatistics';
import FollowUpManager from './FollowUpManager';
import WhatsAppMessages from './WhatsAppMessages';
import DoctorSettings from './DoctorSettings';
import HomeModules from './HomeModules';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handlePatientAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-blue-50 to-indigo-100" data-testid="dashboard">
      <div className="max-w-7xl mx-auto">
        {/* Header with Logo */}
        <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/esdent-logo.png" 
                alt="Esdent Gold Logo" 
                className="h-20 w-auto object-contain"
              />
              <div>
                <p className="text-lg text-gray-600">Hasta Takip ve İstatistik Sistemi</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-7 mb-8 bg-blue-100" data-testid="tabs-list">
                <TabsTrigger value="home" data-testid="tab-home" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Ana Sayfa</TabsTrigger>
                <TabsTrigger value="add" data-testid="tab-add-patient" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Hasta Ekle</TabsTrigger>
                <TabsTrigger value="daily" data-testid="tab-daily-view" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Günlük Görünüm</TabsTrigger>
                <TabsTrigger value="statistics" data-testid="tab-statistics" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">İstatistikler</TabsTrigger>
                <TabsTrigger value="followups" data-testid="tab-followups" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Takipler</TabsTrigger>
                <TabsTrigger value="whatsapp" data-testid="tab-whatsapp" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">WhatsApp</TabsTrigger>
                <TabsTrigger value="settings" data-testid="tab-settings" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Ayarlar</TabsTrigger>
              </TabsList>

              <TabsContent value="home" data-testid="tab-content-home">
                <HomeModules refreshTrigger={refreshTrigger} />
              </TabsContent>

              <TabsContent value="add" data-testid="tab-content-add">
                <PatientForm onPatientAdded={handlePatientAdded} />
              </TabsContent>

              <TabsContent value="daily" data-testid="tab-content-daily">
                <DailyView refreshTrigger={refreshTrigger} onPatientUpdated={handlePatientAdded} />
              </TabsContent>

              <TabsContent value="statistics" data-testid="tab-content-statistics">
                <MonthlyStatistics refreshTrigger={refreshTrigger} />
              </TabsContent>

              <TabsContent value="followups" data-testid="tab-content-followups">
                <FollowUpManager refreshTrigger={refreshTrigger} />
              </TabsContent>

              <TabsContent value="whatsapp" data-testid="tab-content-whatsapp">
                <WhatsAppMessages refreshTrigger={refreshTrigger} />
              </TabsContent>

              <TabsContent value="settings" data-testid="tab-content-settings">
                <DoctorSettings />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}