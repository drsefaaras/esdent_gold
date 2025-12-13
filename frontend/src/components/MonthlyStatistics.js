import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Download, Users, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function MonthlyStatistics({ refreshTrigger }) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, [selectedMonth, selectedYear, refreshTrigger]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/statistics/monthly`, {
        params: {
          year: selectedYear,
          month: selectedMonth
        }
      });
      setStatistics(response.data);
    } catch (error) {
      console.error('İstatistikler yüklenirken hata:', error);
      toast.error('İstatistikler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const response = await axios.get(`${API}/export/monthly-stats-pdf`, {
        params: {
          year: selectedYear,
          month: selectedMonth
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `aylik_istatistik_${selectedYear}_${selectedMonth}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF başarıyla indirildi!');
    } catch (error) {
      console.error('PDF indirilirken hata:', error);
      toast.error('PDF indirilemedi');
    }
  };

  const months = [
    { value: 1, label: 'Ocak' },
    { value: 2, label: 'Şubat' },
    { value: 3, label: 'Mart' },
    { value: 4, label: 'Nisan' },
    { value: 5, label: 'Mayıs' },
    { value: 6, label: 'Haziran' },
    { value: 7, label: 'Temmuz' },
    { value: 8, label: 'Ağustos' },
    { value: 9, label: 'Eylül' },
    { value: 10, label: 'Ekim' },
    { value: 11, label: 'Kasım' },
    { value: 12, label: 'Aralık' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  const visitTypeData = statistics ? [
    { name: 'İmplant', value: statistics.implant_count },
    { name: 'Kontrol', value: statistics.checkup_count },
    { name: 'Muayene', value: statistics.examination_count },
    { name: 'Tekrar Görüşme', value: statistics.revisit_count }
  ].filter(item => item.value > 0) : [];

  const doctorChartData = statistics ? statistics.doctor_stats.map(doc => ({
    name: doc.doctor.replace('DR ', ''),
    muayene: doc.total_examinations,
    kabul: doc.accepted_count
  })) : [];

  const familyChartData = statistics && statistics.family_stats ? statistics.family_stats.slice(0, 6).map(fs => ({
    name: fs.family_group,
    hasta: fs.patient_count,
    kabul: fs.accepted_count
  })) : [];

  const professionChartData = statistics && statistics.profession_stats ? statistics.profession_stats.slice(0, 6).map(ps => ({
    name: ps.profession_group,
    hasta: ps.patient_count,
    kabul: ps.accepted_count
  })) : [];

  return (
    <div className="space-y-6" data-testid="monthly-statistics">
      {/* Date Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <TrendingUp className="w-5 h-5" />
              Aylık İstatistikler
            </CardTitle>
            <Button onClick={downloadPDF} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              <Download className="w-4 h-4 mr-2" />
              PDF İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ay</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
                data-testid="select-month"
              >
                <SelectTrigger data-testid="select-month-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()} data-testid={`month-option-${month.value}`}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yıl</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
                data-testid="select-year"
              >
                <SelectTrigger data-testid="select-year-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()} data-testid={`year-option-${year}`}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-gray-500">İstatistikler yükleniyor...</div>
      ) : !statistics ? (
        <div className="text-center py-8 text-gray-500">Veri bulunamadı</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="border-2 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Toplam Hasta</p>
                  <p className="text-3xl font-bold text-blue-600" data-testid="stat-total-patients">{statistics.total_patients}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">İmplant</p>
                  <p className="text-3xl font-bold text-green-600" data-testid="stat-implants">{statistics.implant_count}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-orange-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Kontrol</p>
                  <p className="text-3xl font-bold text-orange-600" data-testid="stat-checkups">{statistics.checkup_count}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-red-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Muayene</p>
                  <p className="text-3xl font-bold text-red-600" data-testid="stat-examinations">{statistics.examination_count}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-purple-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Tekrar Görüşme</p>
                  <p className="text-3xl font-bold text-purple-600" data-testid="stat-revisits">{statistics.revisit_count}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Doctor Statistics Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-700">Doktor Performansı</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50">
                      <TableHead>Doktor</TableHead>
                      <TableHead>Toplam Muayene</TableHead>
                      <TableHead>Kabul Edilen</TableHead>
                      <TableHead>Kabul Oranı</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statistics.doctor_stats.map((doctor, index) => (
                      <TableRow key={doctor.doctor} data-testid={`doctor-stat-row-${index}`} className="hover:bg-blue-50">
                        <TableCell className="font-medium" data-testid={`doctor-name-${index}`}>{doctor.doctor}</TableCell>
                        <TableCell data-testid={`doctor-examinations-${index}`}>{doctor.total_examinations}</TableCell>
                        <TableCell data-testid={`doctor-accepted-${index}`}>{doctor.accepted_count}</TableCell>
                        <TableCell data-testid={`doctor-rate-${index}`}>
                          <span className="font-semibold text-blue-600">{doctor.acceptance_rate}%</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Family Statistics */}
          {statistics.family_stats && statistics.family_stats.length > 0 && (
            <Card className="border-2 border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <Users className="w-5 h-5" />
                  Aile İstatistikleri
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-orange-50 rounded-lg">
                  <p className="text-lg font-semibold text-orange-900">
                    Toplam Aile Sayısı: {statistics.total_families}
                  </p>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-orange-50">
                        <TableHead>Aile Grubu</TableHead>
                        <TableHead>Hasta Sayısı</TableHead>
                        <TableHead>Kabul Edilen</TableHead>
                        <TableHead>Kabul Oranı</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statistics.family_stats.map((family, index) => (
                        <TableRow key={family.family_group} className="hover:bg-orange-50">
                          <TableCell className="font-medium">{family.family_group}</TableCell>
                          <TableCell>{family.patient_count}</TableCell>
                          <TableCell>{family.accepted_count}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-orange-600">{family.acceptance_rate}%</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profession Statistics */}
          {statistics.profession_stats && statistics.profession_stats.length > 0 && (
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <Briefcase className="w-5 h-5" />
                  Meslek İstatistikleri
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-purple-50">
                        <TableHead>Meslek Grubu</TableHead>
                        <TableHead>Hasta Sayısı</TableHead>
                        <TableHead>Kabul Edilen</TableHead>
                        <TableHead>Kabul Oranı</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statistics.profession_stats.map((profession, index) => (
                        <TableRow key={profession.profession_group} className="hover:bg-purple-50">
                          <TableCell className="font-medium">{profession.profession_group}</TableCell>
                          <TableCell>{profession.patient_count}</TableCell>
                          <TableCell>{profession.accepted_count}</TableCell>
                          <TableCell>
                            <span className="font-semibold text-purple-600">{profession.acceptance_rate}%</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Doctor Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <BarChart3 className="w-5 h-5" />
                  Doktor Muayeneleri
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={doctorChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="muayene" fill="#3b82f6" name="Toplam Muayene" />
                    <Bar dataKey="kabul" fill="#10b981" name="Kabul Edilen" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Visit Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <PieChartIcon className="w-5 h-5" />
                  Ziyaret Tipi Dağılımı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={visitTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {visitTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Family Statistics Chart */}
            {familyChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <Users className="w-5 h-5" />
                    Aile Grupları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={familyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="hasta" fill="#f59e0b" name="Hasta Sayısı" />
                      <Bar dataKey="kabul" fill="#10b981" name="Kabul" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Profession Statistics Chart */}
            {professionChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <Briefcase className="w-5 h-5" />
                    Meslek Grupları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={professionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="hasta" fill="#8b5cf6" name="Hasta Sayısı" />
                      <Bar dataKey="kabul" fill="#10b981" name="Kabul" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
