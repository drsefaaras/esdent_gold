import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HomeModules({ refreshTrigger }) {
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [notAcceptedCount, setNotAcceptedCount] = useState(0);
  const [thinkingCount, setThinkingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  
  const [selectedModule, setSelectedModule] = useState(null);
  const [moduleData, setModuleData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Date filter states
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('day'); // 'day', 'month', 'year'
  const [weeklyWarning, setWeeklyWarning] = useState(null);

  useEffect(() => {
    console.log('HomeModules: useEffect triggered, refreshTrigger:', refreshTrigger);
    fetchCounts();
    fetchOverdueCount();
    if (viewMode === 'month') {
      checkWeeklyTrend();
    }
  }, [refreshTrigger, selectedDate, viewMode]);

  const getDateRange = () => {
    const date = new Date(selectedDate);
    let startDate, endDate;

    if (viewMode === 'day') {
      startDate = date.toISOString().split('T')[0];
      endDate = startDate;
    } else if (viewMode === 'month') {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
    } else if (viewMode === 'year') {
      const year = date.getFullYear();
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    return { startDate, endDate };
  };

  const fetchCounts = async () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      const [accepted, notAccepted, thinking] = await Promise.all([
        axios.get(`${API}/patients/accepted`, { params: { start_date: startDate, end_date: endDate } }),
        axios.get(`${API}/patients/not-accepted`, { params: { start_date: startDate, end_date: endDate } }),
        axios.get(`${API}/patients/thinking`, { params: { start_date: startDate, end_date: endDate } })
      ]);
      
      setAcceptedCount(accepted.data.total);
      setNotAcceptedCount(notAccepted.data.total);
      setThinkingCount(thinking.data.total);
    } catch (error) {
      console.error('Sayılar yüklenirken hata:', error);
    }
  };

  const checkWeeklyTrend = async () => {
    try {
      const date = new Date(selectedDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const response = await axios.get(`${API}/statistics/weekly-trend`, {
        params: { year, month }
      });
      
      if (response.data.warning) {
        setWeeklyWarning(response.data);
      } else {
        setWeeklyWarning(null);
      }
    } catch (error) {
      console.error('Haftalık trend kontrol hatası:', error);
    }
  };

  const fetchOverdueCount = async () => {
    try {
      const response = await axios.get(`${API}/patients/overdue`);
      setOverdueCount(response.data.total);
    } catch (error) {
      console.error('Gecikmiş hastalar kontrol hatası:', error);
    }
  };

  const openOverdueModule = async () => {
    setSelectedModule('overdue');
    setLoading(true);
    
    try {
      const response = await axios.get(`${API}/patients/overdue`);
      setModuleData({
        total: response.data.total,
        patients: response.data.overdue_patients.map(f => ({
          id: f.patient_id,
          patient_name: f.patient_name,
          doctor: f.doctor,
          visit_type: 'Takip',
          visit_date: f.followup_date,
          status: f.patient_status,
          followup_id: f.id
        })),
        stats: {
          implant: 0,
          kontrol: 0,
          muayene: 0,
          doctor_stats: {}
        }
      });
    } catch (error) {
      console.error('Gecikmiş hastalar yüklenirken hata:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const openModule = async (type) => {
    setSelectedModule(type);
    setLoading(true);
    
    try {
      const { startDate, endDate } = getDateRange();
      
      let response;
      if (type === 'accepted') {
        response = await axios.get(`${API}/patients/accepted`, { 
          params: { start_date: startDate, end_date: endDate } 
        });
      } else if (type === 'notAccepted') {
        response = await axios.get(`${API}/patients/not-accepted`, { 
          params: { start_date: startDate, end_date: endDate } 
        });
      } else if (type === 'thinking') {
        response = await axios.get(`${API}/patients/thinking`, { 
          params: { start_date: startDate, end_date: endDate } 
        });
      }
      
      setModuleData(response.data);
    } catch (error) {
      console.error('Modül verileri yüklenirken hata:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (patientId, patientName) => {
    try {
      await axios.post(`${API}/patients/${patientId}/send-reminder`);
      toast.success(`${patientName} için hatırlatma mesajı oluşturuldu. WhatsApp sekmesinden onaylayabilirsiniz.`);
    } catch (error) {
      console.error('Hatırlatma gönderilirken hata:', error);
      toast.error('Hatırlatma gönderilemedi');
    }
  };

  const closeDialog = () => {
    setSelectedModule(null);
    setModuleData(null);
  };

  const getModuleTitle = () => {
    if (selectedModule === 'accepted') return 'Kabul Edilen Hastalar';
    if (selectedModule === 'notAccepted') return 'Kabul Edilmeyen Hastalar';
    if (selectedModule === 'thinking') return 'Düşünüyor';
    if (selectedModule === 'overdue') return 'Gecikmiş Hastalar';
    return '';
  };

  const formatDisplayDate = () => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (viewMode === 'month') {
      return selectedDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'year') {
      return selectedDate.getFullYear().toString();
    }
  };

  const handlePrevious = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'year') {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Hasta Durumu Modülleri</h2>
          
          {/* Overdue Warning Badge */}
          {overdueCount > 0 && (
            <div
              onClick={openOverdueModule}
              className="cursor-pointer bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full flex items-center gap-2 animate-pulse shadow-lg transition-all"
            >
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold">Gecikmiş: {overdueCount}</span>
            </div>
          )}
        </div>
        
        {/* Date Filter Controls */}
        <div className="space-y-3">
          {/* View Mode Selection */}
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant={viewMode === 'day' ? 'default' : 'outline'}
              onClick={() => setViewMode('day')}
              className={viewMode === 'day' ? 'bg-blue-600' : ''}
            >
              Günlük
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'month' ? 'default' : 'outline'}
              onClick={() => setViewMode('month')}
              className={viewMode === 'month' ? 'bg-blue-600' : ''}
            >
              Aylık
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'year' ? 'default' : 'outline'}
              onClick={() => setViewMode('year')}
              className={viewMode === 'year' ? 'bg-blue-600' : ''}
            >
              Yıllık
            </Button>
          </div>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-2 bg-blue-100 rounded-lg px-4 py-2">
            <Button size="sm" variant="ghost" onClick={handlePrevious}>
              ◀
            </Button>
            <div className="min-w-[200px] text-center">
              <p className="text-sm font-semibold text-blue-700">
                📅 {formatDisplayDate()}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={handleNext}>
              ▶
            </Button>
            <Button size="sm" variant="outline" onClick={handleToday} className="ml-2">
              Bugün
            </Button>
          </div>
        </div>
      </div>

      {/* Weekly Warning Alert */}
      {weeklyWarning && weeklyWarning.warning && (
        <Card className="border-4 border-red-500 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-600 rounded-full">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-red-800">{weeklyWarning.message}</p>
                <p className="text-sm text-red-700 mt-1">
                  Bu Hafta: {weeklyWarning.current_count} hasta | 
                  Aylık Ortalama: {weeklyWarning.average} hasta | 
                  Beklenen Minimum: {weeklyWarning.threshold} hasta
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Accepted Patients */}
        <Card 
          className="border-4 border-green-300 hover:border-green-500 cursor-pointer transition-all hover:shadow-2xl bg-gradient-to-br from-green-50 to-green-100"
          onClick={() => openModule('accepted')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-8 h-8" />
              Kabul Edilen Hastalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-6xl font-bold text-green-600">{acceptedCount}</p>
              <p className="text-sm text-gray-600 mt-2">
                {viewMode === 'day' ? 'Günlük' : viewMode === 'month' ? 'Aylık' : 'Yıllık'} hasta
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Not Accepted Patients */}
        <Card 
          className="border-4 border-red-300 hover:border-red-500 cursor-pointer transition-all hover:shadow-2xl bg-gradient-to-br from-red-50 to-red-100"
          onClick={() => openModule('notAccepted')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="w-8 h-8" />
              Kabul Edilmeyen Hastalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-6xl font-bold text-red-600">{notAcceptedCount}</p>
              <p className="text-sm text-gray-600 mt-2">
                {viewMode === 'day' ? 'Günlük' : viewMode === 'month' ? 'Aylık' : 'Yıllık'} hasta
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Thinking Patients */}
        <Card 
          className="border-4 border-yellow-300 hover:border-yellow-500 cursor-pointer transition-all hover:shadow-2xl bg-gradient-to-br from-yellow-50 to-yellow-100"
          onClick={() => openModule('thinking')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <Clock className="w-8 h-8" />
              Düşünüyor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-6xl font-bold text-yellow-600">{thinkingCount}</p>
              <p className="text-sm text-gray-600 mt-2">
                {viewMode === 'day' ? 'Günlük' : viewMode === 'month' ? 'Aylık' : 'Yıllık'} hasta
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={selectedModule !== null} onOpenChange={closeDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-blue-700">{getModuleTitle()}</DialogTitle>
          </DialogHeader>
          
          {loading ? (
            <div className="text-center py-8">Yükleniyor...</div>
          ) : moduleData ? (
            <div className="space-y-6">
              {/* Statistics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600">Toplam</p>
                    <p className="text-3xl font-bold text-blue-600">{moduleData.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600">İmplant</p>
                    <p className="text-3xl font-bold text-green-600">{moduleData.stats.implant}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600">Kontrol</p>
                    <p className="text-3xl font-bold text-orange-600">{moduleData.stats.kontrol}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-600">Muayene</p>
                    <p className="text-3xl font-bold text-red-600">{moduleData.stats.muayene}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Doctor Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle>Doktor Bazlı İstatistikler</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(moduleData.stats.doctor_stats).map(([doctor, count]) => (
                      <div key={doctor} className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-600 truncate">{doctor}</p>
                        <p className="text-2xl font-bold text-blue-600">{count}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Patient List */}
              <Card>
                <CardHeader>
                  <CardTitle>Hasta Listesi ({moduleData.patients.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {moduleData.patients.length === 0 ? (
                    <p className="text-center py-4 text-gray-500">Hasta bulunamadı</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-blue-50">
                            <TableHead>Hasta Adı</TableHead>
                            <TableHead>Doktor</TableHead>
                            <TableHead>Ziyaret Tipi</TableHead>
                            <TableHead>Tarih</TableHead>
                            {selectedModule === 'thinking' && <TableHead>İşlem</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {moduleData.patients.map((patient, index) => (
                            <TableRow key={patient.id} className="hover:bg-blue-50">
                              <TableCell className="font-medium">{patient.patient_name}</TableCell>
                              <TableCell>{patient.doctor}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{patient.visit_type}</Badge>
                              </TableCell>
                              <TableCell>{patient.visit_date}</TableCell>
                              {selectedModule === 'thinking' && (
                                <TableCell>
                                  <Button
                                    size="sm"
                                    onClick={() => sendReminder(patient.id, patient.patient_name)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Send className="w-3 h-3 mr-1" />
                                    Onayla ve Gönder
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}