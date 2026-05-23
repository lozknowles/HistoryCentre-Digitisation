from django.shortcuts import render, get_object_or_404, redirect
from .models import Record
from .forms import RecordForm

def record_list(request):
    records = Record.objects.all()
    return render(request, 'record_list.html', {'records': records})

def record_detail(request, pk):
    record = get_object_or_404(Record, pk=pk)
    return render(request, 'record_detail.html', {'record': record})

def record_create(request):
    if request.method == "POST":
        form = RecordForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('record_list')
    else:
        form = RecordForm()
    return render(request, 'record_form.html', {'form': form})

def record_update(request, pk):
    record = get_object_or_404(Record, pk=pk)
    if request.method == "POST":
        form = RecordForm(request.POST, instance=record)
        if form.is_valid():
            form.save()
            return redirect('record_list')
    else:
        form = RecordForm(instance=record)
    return render(request, 'record_form.html', {'form': form})

def record_delete(request, pk):
    record = get_object_or_404(Record, pk=pk)
    if request.method == "POST":
        record.delete()
        return redirect('record_list')
    return render(request, 'record_confirm_delete.html', {'record': record})
