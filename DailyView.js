import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CheckCircle, XCircle, Download, RefreshCw, Edit, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DailyView({ refreshTrigger, onPatientUpdated }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [familyGroups, setFamilyGroups] = useState([]);
  const [professionGroups, setProfessionGroups] = useState([]);
  const [familyFilter, setFamilyFilter] = useState('');
  const [professionFilter, setProfessionFilter] = useState('');
  
  // Edit modal states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [visitTypes, setVisitTypes] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [formData, setFormData] = useState({
    visit_date: '',
    patient_name: '',
    phone_number: '',
    doctor: '',
    visit_type: '',
    status: '',
    family_group: '',
    profession_group: '',
    is_revisit: false,
    revisit_date: '',
    notes: ''
  });

  useEffect(() => {
    fetchDailyPatients();
    fetchFamilyGroups();
    fetchProfessionGroups();
  }, [selectedDate, refreshTrigger]);

  const fetchDailyPatients = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/patients/daily`, {
        params: { date: selectedDate }
      });
      setPatients(response.data.patients);
    } catch (error) {
      console.error('Günlük hastalar yüklenirken hata:', error);
      toast.error('Hastalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilyGroups = async () => {
    try {
      const response = await axios.get(`${API}/family-groups`);
      setFamilyGroups(response.data.family_groups);
    } catch (error) {
      console.error('Aile grupları yüklenirken hata:', error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API}/doctors`);
      setDoctors(response.data.doctors);
    } catch (error) {
      console.error('Doktorlar yüklenirken hata:', error);
    }
  };

  const fetchVisitTypes = async () => {
    try {
      const response = await axios.get(`${API}/visit-types`);
      setVisitTypes(response.data.visit_types);
    } catch (error) {
      console.error('Ziyaret tipleri yüklenirken hata:', error);
    }
  };


  const fetchProfessionGroups = async () => {
    try {
      const response = await axios.get(`${API}/profession-groups`);
      setProfessionGroups(response.data.profession_groups);
    } catch (error) {
      console.error('Meslek grupları yüklenirken hata:', error);
    }
  };

  const handleRevisit = async (patientId, patientName) => {
    const revisitDate = new Date();
    revisitDate.setDate(revisitDate.getDate() + 7);
    const formattedDate = revisitDate.toISOString().split('T')[0];

    try {
      await axios.patch(`${API}/patients/${patientId}/revisit?revisit_date=${formattedDate}`);
      toast.success(`${patientName} tekrar görüşme olarak işaretlendi (${formattedDate})`);
      fetchDailyPatients();
    } catch (error) {
      console.error('Tekrar görüşme işaretlenirken hata:', error);
      toast.error('İşlem başarısız');
    }
  };

  const openEditDialog = async (patient) => {
    setEditingPatient(patient);
    
    // Fetch doctors and visit types if not already loaded
    if (doctors.length === 0) await fetchDoctors();
    if (visitTypes.length === 0) await fetchVisitTypes();
    
    // Map status to selectedStatus
    let statusKey = null;
    if (patient.status === 'kabul etti') statusKey = 'accepted';
    else if (patient.status === 'kabul etmedi') statusKey = 'notAccepted';
    else if (patient.status === 'düşünüyor') statusKey = 'thinking';
    
    setSelectedStatus(statusKey);
    
    setFormData({
      visit_date: patient.visit_date,
      patient_name: patient.patient_name,
      phone_number: patient.phone_number || '',
      doctor: patient.doctor,
      visit_type: patient.visit_type,
      status: patient.status,
      family_group: patient.family_group || '',
      profession_group: patient.profession_group || '',
      is_revisit: patient.is_revisit || false,
      revisit_date: patient.revisit_date || '',
      notes: patient.notes || ''
    });
    
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingPatient(null);
    setSelectedStatus(null);
    setFormData({
      visit_date: '',
      patient_name: '',
      phone_number: '',
      doctor: '',
      visit_type: '',
      status: '',
      family_group: '',
      profession_group: '',
      is_revisit: false,
      revisit_date: '',
      notes: ''
    });
  };

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    // Map UI status to backend status strings
    let statusValue = '';
    if (status === 'accepted') {
      statusValue = 'kabul etti';
    } else if (status === 'notAccepted') {
      statusValue = 'kabul etmedi';
    } else if (status === 'thinking') {
      statusValue = 'düşünüyor';
    }
    
    // Use functional update to ensure we have the latest state
    setFormData(prev => ({
      ...prev,
      status: statusValue
    }));
    
    console.log('handleStatusSelect:', status, '-> statusValue:', statusValue);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.patient_name || !formData.doctor || !formData.visit_type) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (!selectedStatus) {
      toast.error('Lütfen hasta durumunu seçin');
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${API}/patients/${editingPatient.id}`, formData);
      toast.success('Hasta bilgileri güncellendi!');
      fetchDailyPatients();
      closeEditDialog();
      
      // Notify parent to refresh dashboard
      if (onPatientUpdated) {
        console.log('DailyView: Calling onPatientUpdated callback');
        onPatientUpdated();
      } else {
        console.warn('DailyView: onPatientUpdated callback not provided');
      }
    } catch (error) {
      console.error('Hasta güncellenirken hata:', error);
      toast.error('Hasta güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (patient) => {
    if (!window.confirm(`${patient.patient_name} hastasını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API}/patients/${patient.id}`);
      toast.success('Hasta silindi');
      fetchDailyPatients();
      
      // Notify parent to refresh dashboard
      if (onPatientUpdated) {
        console.log('DailyView: Calling onPatientUpdated callback');
        onPatientUpdated();
      } else {
        console.warn('DailyView: onPatientUpdated callback not provided');
      }
    } catch (error) {
      console.error('Hasta silinirken hata:', error);
      toast.error('Hasta silinemedi');
    } finally {
      setLoading(false);
    }
  };


  const downloadPDF = async () => {
    try {
      const response = await axios.get(`${API}/export/daily-report-pdf`, {
        params: { date: selectedDate },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `gunluk_rapor_${selectedDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF başarıyla indirildi!');
    } catch (error) {
      console.error('PDF indirilirken hata:', error);
      toast.error('PDF indirilemedi');
    }
  };

  const filteredPatients = patients.filter(patient => {
    // Only count these three visit types
    if (!['implant', 'kontrol', 'muayene'].includes(patient.visit_type)) return false;
    if (familyFilter && patient.family_group !== familyFilter) return false;
    if (professionFilter && patient.profession_group !== professionFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6" data-testid="daily-view">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Calendar className="w-5 h-5" />
              Günlük Hasta Listesi
            </CardTitle>
            <Button onClick={downloadPDF} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
              <Download className="w-4 h-4 mr-2" />
              PDF İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Tarih Seç</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="input-select-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Aile Grubu Filtrele</Label>
              <Select value={familyFilter || "all"} onValueChange={(value) => setFamilyFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {familyGroups.map((fg) => (
                    <SelectItem key={fg} value={fg}>{fg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Meslek Grubu Filtrele</Label>
              <Select value={professionFilter || "all"} onValueChange={(value) => setProfessionFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {professionGroups.map((pg) => (
                    <SelectItem key={pg} value={pg}>{pg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Statistics Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            <Card className="border-2 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Toplam</p>
                  <p className="text-3xl font-bold text-blue-600">{filteredPatients.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Kabul Edilen</p>
                  <p className="text-3xl font-bold text-green-600">
                    {filteredPatients.filter(p => p.status === 'kabul etti').length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-red-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Kabul Edilmeyen</p>
                  <p className="text-3xl font-bold text-red-600">
                    {filteredPatients.filter(p => p.status === 'kabul etmedi').length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-yellow-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Düşünüyor</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {filteredPatients.filter(p => p.status === 'düşünüyor').length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-gray-500" data-testid="no-patients-message">
              Bu tarih için hasta bulunamadı
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50">
                    <TableHead>Hasta Adı</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Doktor</TableHead>
                    <TableHead>Ziyaret Tipi</TableHead>
                    <TableHead>Aile Grubu</TableHead>
                    <TableHead>Meslek</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient, index) => (
                    <TableRow key={patient.id} data-testid={`patient-row-${index}`} className="hover:bg-blue-50">
                      <TableCell className="font-medium" data-testid={`patient-name-${index}`}>
                        {patient.patient_name}
                        {patient.is_revisit && (
                          <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-700 border-purple-300">Tekrar</Badge>
                        )}
                      </TableCell>
                      <TableCell data-testid={`patient-phone-${index}`}>
                        {patient.phone_number || '-'}
                      </TableCell>
                      <TableCell data-testid={`patient-doctor-${index}`}>{patient.doctor}</TableCell>
                      <TableCell data-testid={`patient-visit-type-${index}`}>
                        <Badge variant="secondary" className="bg-blue-100">{patient.visit_type}</Badge>
                      </TableCell>
                      <TableCell>{patient.family_group || '-'}</TableCell>
                      <TableCell>{patient.profession_group || '-'}</TableCell>
                      <TableCell data-testid={`patient-status-${index}`}>
                        {patient.status === 'kabul etti' ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            Kabul Edildi
                          </span>
                        ) : patient.status === 'düşünüyor' ? (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Clock className="w-4 h-4" />
                            Düşünüyor
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" />
                            Kabul Edilmedi
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(patient)}
                            className="border-blue-600 text-blue-600 hover:bg-blue-50"
                            data-testid={`btn-edit-${index}`}
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Düzenle
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(patient)}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                            data-testid={`btn-delete-${index}`}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Sil
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Patient Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={closeEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hasta Bilgilerini Düzenle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visit Date */}
                <div className="space-y-2">
                  <Label htmlFor="edit-visit-date">Ziyaret Tarihi *</Label>
                  <Input
                    id="edit-visit-date"
                    type="date"
                    value={formData.visit_date}
                    onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                    required
                  />
                </div>

                {/* Patient Name */}
                <div className="space-y-2">
                  <Label htmlFor="edit-patient-name">Hasta Adı *</Label>
                  <Input
                    id="edit-patient-name"
                    type="text"
                    placeholder="Hasta adını girin"
                    value={formData.patient_name}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    required
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="edit-phone-number">Telefon Numarası</Label>
                  <Input
                    id="edit-phone-number"
                    type="tel"
                    placeholder="+90 5XX XXX XX XX"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>

                {/* Doctor */}
                <div className="space-y-2">
                  <Label htmlFor="edit-doctor">Doktor *</Label>
                  <Select
                    value={formData.doctor}
                    onValueChange={(value) => setFormData({ ...formData, doctor: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Doktor seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor} value={doctor}>
                          {doctor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Visit Type */}
                <div className="space-y-2">
                  <Label htmlFor="edit-visit-type">Ziyaret Tipi *</Label>
                  <Select
                    value={formData.visit_type}
                    onValueChange={(value) => setFormData({ ...formData, visit_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ziyaret tipi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {visitTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Family Group */}
                <div className="space-y-2">
                  <Label htmlFor="edit-family-group">Aile Grubu</Label>
                  <Input
                    id="edit-family-group"
                    type="text"
                    placeholder="Aile grubu adı"
                    value={formData.family_group}
                    onChange={(e) => setFormData({ ...formData, family_group: e.target.value })}
                  />
                </div>

                {/* Profession Group */}
                <div className="space-y-2">
                  <Label htmlFor="edit-profession-group">Meslek Grubu</Label>
                  <Input
                    id="edit-profession-group"
                    type="text"
                    placeholder="Meslek grubu"
                    value={formData.profession_group}
                    onChange={(e) => setFormData({ ...formData, profession_group: e.target.value })}
                  />
                </div>
              </div>

              {/* Patient Status Selection - 3 Cards */}
              <div className="space-y-3">
                <Label className="text-lg font-semibold">Hasta Durumu Seçin *</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Accepted */}
                  <div
                    onClick={() => handleStatusSelect('accepted')}
                    className={`cursor-pointer border-4 rounded-lg p-4 transition-all hover:shadow-lg ${
                      selectedStatus === 'accepted'
                        ? 'border-green-500 bg-green-50'
                        : 'border-green-200 bg-white hover:border-green-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className={`w-8 h-8 ${selectedStatus === 'accepted' ? 'text-green-600' : 'text-green-400'}`} />
                      <div>
                        <p className={`font-bold ${selectedStatus === 'accepted' ? 'text-green-700' : 'text-gray-700'}`}>
                          Kabul Edildi
                        </p>
                      </div>
                    </div>
                    {selectedStatus === 'accepted' && (
                      <div className="mt-2 text-center">
                        <span className="inline-block px-3 py-1 bg-green-600 text-white text-xs rounded-full">Seçildi ✓</span>
                      </div>
                    )}
                  </div>

                  {/* Not Accepted */}
                  <div
                    onClick={() => handleStatusSelect('notAccepted')}
                    className={`cursor-pointer border-4 rounded-lg p-4 transition-all hover:shadow-lg ${
                      selectedStatus === 'notAccepted'
                        ? 'border-red-500 bg-red-50'
                        : 'border-red-200 bg-white hover:border-red-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className={`w-8 h-8 ${selectedStatus === 'notAccepted' ? 'text-red-600' : 'text-red-400'}`} />
                      <div>
                        <p className={`font-bold ${selectedStatus === 'notAccepted' ? 'text-red-700' : 'text-gray-700'}`}>
                          Kabul Edilmedi
                        </p>
                      </div>
                    </div>
                    {selectedStatus === 'notAccepted' && (
                      <div className="mt-2 text-center">
                        <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs rounded-full">Seçildi ✓</span>
                      </div>
                    )}
                  </div>

                  {/* Thinking */}
                  <div
                    onClick={() => handleStatusSelect('thinking')}
                    className={`cursor-pointer border-4 rounded-lg p-4 transition-all hover:shadow-lg ${
                      selectedStatus === 'thinking'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-yellow-200 bg-white hover:border-yellow-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className={`w-8 h-8 ${selectedStatus === 'thinking' ? 'text-yellow-600' : 'text-yellow-400'}`} />
                      <div>
                        <p className={`font-bold ${selectedStatus === 'thinking' ? 'text-yellow-700' : 'text-gray-700'}`}>
                          Düşünüyor
                        </p>
                      </div>
                    </div>
                    {selectedStatus === 'thinking' && (
                      <div className="mt-2 text-center">
                        <span className="inline-block px-3 py-1 bg-yellow-600 text-white text-xs rounded-full">Seçildi ✓</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Revisit Checkbox */}
              <div className="flex items-center space-x-2">
                <input
                  id="edit-is-revisit"
                  type="checkbox"
                  checked={formData.is_revisit}
                  onChange={(e) => setFormData({ ...formData, is_revisit: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-is-revisit" className="cursor-pointer">
                  Tekrar Görüşme
                </Label>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notlar (Opsiyonel)</Label>
                <Textarea
                  id="edit-notes"
                  placeholder="Ek notlar girin..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeEditDialog}>
                İptal
              </Button>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Güncelleniyor...' : 'Güncelle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}